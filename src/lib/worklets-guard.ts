/**
 * Worklets JSI Safety Guard
 *
 * In React Native debug builds, facebook::jsi::Value::getString asserts that the value
 * is a string (assert(isString())). In react-native-worklets, createSerializableError
 * and other serializers invoke getString on passed parameters without verifying type.
 * If an error with undefined/null name or message is serialized, the native layer aborts
 * with SIGABRT (assertion "isString()" failed).
 *
 * This guard intercepts __workletsModuleProxy on globalThis and sanitizes arguments
 * before they reach native JSI code.
 */

function sanitizeString(val: unknown, fallback: string): string {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return fallback;
  try {
    return String(val);
  } catch {
    return fallback;
  }
}

function patchWorkletsProxy(proxy: any) {
  if (!proxy || typeof proxy !== 'object' || proxy.__workletsGuardPatched) {
    return proxy;
  }

  try {
    const origCreateSerializableError = proxy.createSerializableError;
    if (typeof origCreateSerializableError === 'function') {
      proxy.createSerializableError = function (name: unknown, message: unknown, stack: unknown) {
        const safeName = sanitizeString(name, 'Error');
        const safeMessage = sanitizeString(message, '');
        const safeStack = typeof stack === 'string' ? stack : undefined;

        console.warn(`[WorkletsGuard] Intercepted Error serialization: [${safeName}] ${safeMessage}`);
        return origCreateSerializableError.call(proxy, safeName, safeMessage, safeStack);
      };
    }

    const origCreateSerializableRegExp = proxy.createSerializableRegExp;
    if (typeof origCreateSerializableRegExp === 'function') {
      proxy.createSerializableRegExp = function (pattern: unknown, flags: unknown) {
        return origCreateSerializableRegExp.call(
          proxy,
          sanitizeString(pattern, ''),
          sanitizeString(flags, ''),
        );
      };
    }

    const origCreateSerializableNonWorkletFunction = proxy.createSerializableNonWorkletFunction;
    if (typeof origCreateSerializableNonWorkletFunction === 'function') {
      proxy.createSerializableNonWorkletFunction = function (fn: unknown, name: unknown) {
        return origCreateSerializableNonWorkletFunction.call(
          proxy,
          fn,
          typeof name === 'string' ? name : undefined,
        );
      };
    }

    const origCreateSerializableArrayBufferView = proxy.createSerializableArrayBufferView;
    if (typeof origCreateSerializableArrayBufferView === 'function') {
      proxy.createSerializableArrayBufferView = function (
        typeName: unknown,
        buffer: unknown,
        offset: unknown,
        length: unknown,
      ) {
        return origCreateSerializableArrayBufferView.call(
          proxy,
          sanitizeString(typeName, 'Uint8Array'),
          buffer,
          offset,
          length,
        );
      };
    }

    proxy.__workletsGuardPatched = true;
    console.log('[WorkletsGuard] Successfully protected __workletsModuleProxy');
  } catch (err) {
    console.warn('[WorkletsGuard] Failed to patch proxy:', err);
  }

  return proxy;
}

// Ensure Error prototypes always have valid string properties in Hermes
try {
  if (typeof Error.prototype.name !== 'string') {
    Error.prototype.name = 'Error';
  }
  if (typeof Error.prototype.message !== 'string') {
    Error.prototype.message = '';
  }
} catch {}

// Patch existing proxy if already defined
if ((globalThis as any).__workletsModuleProxy) {
  patchWorkletsProxy((globalThis as any).__workletsModuleProxy);
}

// Intercept future assignment of __workletsModuleProxy
let _currentProxy = (globalThis as any).__workletsModuleProxy;
try {
  Object.defineProperty(globalThis, '__workletsModuleProxy', {
    configurable: true,
    enumerable: true,
    get() {
      return _currentProxy;
    },
    set(newProxy) {
      _currentProxy = patchWorkletsProxy(newProxy);
    },
  });
} catch (err) {
  console.warn('[WorkletsGuard] Failed to defineProperty on globalThis:', err);
}

// Global JS error reporter
if (typeof (globalThis as any).ErrorUtils !== 'undefined' && (globalThis as any).ErrorUtils?.setGlobalHandler) {
  const defaultHandler = (globalThis as any).ErrorUtils.getGlobalHandler?.();
  (globalThis as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.error('[GlobalErrorHandler]', isFatal ? 'FATAL:' : 'NON-FATAL:', error?.name, error?.message, error?.stack);
    if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}
