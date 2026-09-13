import { useCallback, useState } from 'react';

export function useImagePreview() {
  const [uri, setUri] = useState<string | null>(null);
  const open = useCallback((imageUri: string) => setUri(imageUri), []);
  const close = useCallback(() => setUri(null), []);
  return { uri, open, close, visible: uri !== null };
}
