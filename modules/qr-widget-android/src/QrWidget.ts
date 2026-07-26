import { NativeModule, requireNativeModule } from 'expo';

declare class QrWidgetModule extends NativeModule {
  saveQrImage(path: string): Promise<void>;
  showQrNotification(imagePath: string): Promise<void>;
  hideQrNotification(): Promise<void>;
  hasDndBypassAccess(): Promise<boolean>;
  openDndBypassSettings(): Promise<void>;
}

export default requireNativeModule<QrWidgetModule>('QrWidget');
