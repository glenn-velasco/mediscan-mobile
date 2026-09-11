/**
 * React Query cache keys, pulled out of their feature hooks so services that only need to invalidate
 * a cache (merge.service.ts, AuthContext.tsx) don't have to import the hook itself — importing the
 * hook drags in useAuth -> AuthContext, which is how those two ended up in a require cycle.
 */
export const allergiesQueryKey = ['allergies'] as const;
export const conditionsQueryKey = ['conditions'] as const;
export const diagnosesQueryKey = ['diagnoses'] as const;
export const medicationsQueryKey = ['medications'] as const;
export const emergencyContactsQueryKey = ['emergency-contacts'] as const;
export const medicalInformationQueryKey = ['medical-information'] as const;
export const medicalInformationAvatarQueryKey = ['medical-information', 'avatar'] as const;
export const attestationsQueryKey = ['professional-attestations'] as const;
export const professionalApplicationQueryKey = ['professional-application'] as const;
export const myProfessionalApplicationQueryKey = ['professional-application', 'mine'] as const;
export const professionalApplicationBroadcastStatusQueryKey = ['professional-application-broadcast-status'] as const;
export const accountRetrievalRequestQueryKey = ['account-retrieval-request'] as const;
export const professionalScansQueryKey = ['professional-scans'] as const;
export const myScanActivityQueryKey = ['my-scan-activity'] as const;
