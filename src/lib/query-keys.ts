/**
 * React Query cache keys, pulled out of their feature hooks so services that only need to invalidate
 * a cache (merge.service.ts, AuthContext.tsx) don't have to import the hook itself — importing the
 * hook drags in useAuth -> AuthContext, which is how those two ended up in a require cycle.
 */
export const allergiesQueryKey = ['allergies'] as const;
export const diagnosesQueryKey = ['diagnoses'] as const;
export const medicationsQueryKey = ['medications'] as const;
export const medicalInformationQueryKey = ['medical-information'] as const;
export const attestationsQueryKey = ['professional-attestations'] as const;
export const professionalApplicationQueryKey = ['professional-application'] as const;
// Separate from professionalApplicationQueryKey: holds just the last status seen over the
// realtime broadcast, so the status screen has something to show even when the GET-by-id 404s
// (e.g. the backend removes/relocates the record once an application is denied).
export const professionalApplicationBroadcastStatusQueryKey = ['professional-application-broadcast-status'] as const;
