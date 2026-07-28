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

## Deep link routes

The app's URL scheme is `mediscanmobile://` (defined in `app.json`). Expo Router maps deep links to file-based routes automatically — no `Linking.addEventListener` or manual URL parsing needed.

When adding a new deep link target:

1. **Create the route file** under `src/app/` (e.g., `src/app/email-verified.tsx`).
2. **Register it in the `guard={ready}` block** in `src/app/_layout.tsx` so it's accessible regardless of auth state.
3. **Call `refreshUser()` or relevant data fetches** in the route's `useEffect` to pull server-side state changes triggered by the deep link.

### Existing deep link targets

| Deep link | Route file | Purpose |
|---|---|---|
| `mediscanmobile://email-verified` | `src/app/email-verified.tsx` | Email verification — server verifies signed URL, redirects here via 302. |

### Pattern: server-verified deep links

For actions that require cryptographic verification (e.g., email verification, password reset):

1. Email contains a signed HTTPS URL pointing to a backend API route.
2. Backend verifies the signature, performs the action, and issues a `302` redirect to the deep link.
3. The deep link opens the app, which calls `refreshUser()` to pull the updated state.

This keeps all crypto on the server — the app never handles hashes or signatures directly.
