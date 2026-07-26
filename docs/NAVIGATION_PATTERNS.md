# Navigation patterns

## Always guard onPress handlers that navigate

Any `onPress` that calls `router.push` / `router.navigate` — directly, or after some side effect like marking a notification read — must be wrapped with [`useGuardedPress`](../src/lib/use-guarded-press.ts).

Without it, rapidly repeated taps on the same pressable (a laggy transition, a user double/triple tapping a link) fire the handler once per tap. Each call pushes another instance of the same screen onto the navigation stack, so back-navigation has to walk through several duplicate pages before actually leaving. `useGuardedPress` locks the handler for a short delay (800ms by default) after the first call, so a tap burst results in exactly one navigation.

```ts
import { useGuardedPress } from '@/lib/use-guarded-press';

const handlePress = useGuardedPress((item: AppNotification) => {
  void markRead(item.id);
  if (item.href) router.push(item.href as never);
});
```

Apply this on every new navigation `onPress`, not just where a duplicate-stack bug has already been reported — it's cheap and prevents the same class of issue elsewhere.

Existing usages to follow as examples:
- [src/app/(app)/notifications.tsx](../src/app/(app)/notifications.tsx)
- [src/app/(app)/index.tsx](../src/app/(app)/index.tsx) — a single shared `guardedPush` wraps every `router.push` call on the screen
- [src/app/allergies/_layout.tsx](../src/app/allergies/_layout.tsx), `diagnoses/_layout.tsx`, `medications/_layout.tsx` — header "add" buttons
- `src/components/*-bottom-sheet.tsx` (allergies, diagnoses, emergency-contacts, medications) — row taps

This does not apply to `expo-router`'s declarative `<Link>` component, which uses `navigate` semantics by default and doesn't stack duplicate screens the same way `router.push` does.
