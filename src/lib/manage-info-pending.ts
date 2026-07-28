import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';

let _pendingQrData: string | null = null;
let _updatedInfo: ScannedEmergencyInfo | null = null;

export function setPendingManageInfoQrData(data: string) {
  _pendingQrData = data;
}

export function consumePendingManageInfoQrData(): string | null {
  const data = _pendingQrData;
  _pendingQrData = null;
  return data;
}

export function setUpdatedScannedInfo(info: ScannedEmergencyInfo) {
  _updatedInfo = info;
}

export function consumeUpdatedScannedInfo(): ScannedEmergencyInfo | null {
  const info = _updatedInfo;
  _updatedInfo = null;
  return info;
}
