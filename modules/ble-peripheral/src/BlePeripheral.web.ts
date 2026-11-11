const noopSubscription = { remove: () => {} };

const BlePeripheralWeb = {
  addListener: () => noopSubscription,
  async startAdvertising(): Promise<void> {},
  async stopAdvertising(): Promise<void> {},
  async sendAck(): Promise<void> {},
};

export default BlePeripheralWeb;
