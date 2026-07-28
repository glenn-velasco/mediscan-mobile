import { useQrWidgetToggleStore } from '@/features/qr-widget/qr-widget-toggle.store';

/**
 * React binding for the shared toggle state in `qr-widget-toggle.store.ts`. Every caller — the
 * Account screen's switch and the Home screen's `useQrWidget` — observes the same value, so a
 * change on one screen reaches the other immediately.
 */
export function useQrWidgetToggle() {
  const enabled = useQrWidgetToggleStore((s) => s.enabled);
  const loaded = useQrWidgetToggleStore((s) => s.loaded);
  const setEnabled = useQrWidgetToggleStore((s) => s.setEnabled);

  return { enabled, loaded, setEnabled };
}
