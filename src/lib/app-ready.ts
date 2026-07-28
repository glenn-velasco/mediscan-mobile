let appReady = false;

export function setAppReady(ready: boolean): void {
  appReady = ready;
}

export function getAppReady(): boolean {
  return appReady;
}
