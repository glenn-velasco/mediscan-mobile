import { createContext, useContext } from 'react';

/**
 * Lets screens reachable from the lightweight quick-scan boot (see src/app/_layout.tsx) request an
 * upgrade to the full app tree before navigating somewhere the lightweight single-screen Stack
 * doesn't have registered (e.g. `/(auth)`, `/(app)`). The returned promise resolves once the full
 * tree has finished booting (fonts/db/auth/onboarding), matching the cost the pre-lightweight
 * redirect flow always paid up front.
 */
type LightweightModeContextValue = {
  isLightweight: boolean;
  promoteToFullApp: () => Promise<void>;
};

export const LightweightModeContext = createContext<LightweightModeContextValue>({
  isLightweight: false,
  promoteToFullApp: async () => {},
});

export function useLightweightMode() {
  return useContext(LightweightModeContext);
}
