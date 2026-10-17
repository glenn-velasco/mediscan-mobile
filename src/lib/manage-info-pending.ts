import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';

let _pendingQrData: string | null = null;
let _pendingInfo: ScannedEmergencyInfo | null = null;
let _updatedInfo: ScannedEmergencyInfo | null = null;

export function setPendingManageInfo(data: { qrData?: string; info?: ScannedEmergencyInfo | null }) {
  if (data.qrData !== undefined) _pendingQrData = data.qrData;
  if (data.info !== undefined) _pendingInfo = data.info;
}

export function consumePendingManageInfo(): { qrData: string | null; info: ScannedEmergencyInfo | null } {
  const qrData = _pendingQrData;
  const info = _pendingInfo;
  _pendingQrData = null;
  _pendingInfo = null;
  return { qrData, info };
}

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
