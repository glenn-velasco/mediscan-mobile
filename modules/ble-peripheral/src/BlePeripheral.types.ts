export type EnvelopeChunkReceivedEvent = {
  /** Raw length-prefixed chunk string, see src/lib/ble-chunking.ts. */
  chunk: string;
};

export type CentralConnectedEvent = {
  centralId: string;
};

export type CentralDisconnectedEvent = {
  centralId: string;
};

export type BlePeripheralModuleEvents = {
  onEnvelopeChunkReceived: (event: EnvelopeChunkReceivedEvent) => void;
  onCentralConnected: (event: CentralConnectedEvent) => void;
  onCentralDisconnected: (event: CentralDisconnectedEvent) => void;
};
