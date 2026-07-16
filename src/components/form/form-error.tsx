import { ThemedText } from '@/components/themed-text';

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <ThemedText type="small" color="destructive" className="mb-2">
      {message}
    </ThemedText>
  );
}
