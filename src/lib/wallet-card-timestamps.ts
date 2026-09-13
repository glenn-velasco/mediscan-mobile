export function formatWalletCardTimestamps(issuedAt: string, medicalDataUpdatedAt?: string | null): { issued: string; updated: string } {
  return {
    issued: new Date(issuedAt).toLocaleDateString(),
    updated: medicalDataUpdatedAt ? new Date(medicalDataUpdatedAt).toLocaleString() : 'Not yet published',
  };
}
