const QrWidgetWeb = {
  async saveQrImage(): Promise<void> {},
  async showQrNotification(): Promise<void> {},
  async hideQrNotification(): Promise<void> {},
  async hasDndBypassAccess(): Promise<boolean> {
    return false;
  },
  async openDndBypassSettings(): Promise<void> {},
};

export default QrWidgetWeb;
