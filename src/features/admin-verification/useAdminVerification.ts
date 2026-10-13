import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getAdminProfessionalApplication, getAdminProfessionalApplications, inviteAdmin, reviewProfessionalApplication } from '@/api/endpoints/professional-applications';
import { adminProfessionalApplicationsQueryKey } from '@/lib/query-keys';

export function useAdminProfessionalApplications() {
  return useQuery({ queryKey: adminProfessionalApplicationsQueryKey, queryFn: getAdminProfessionalApplications, staleTime: 0, refetchOnMount: 'always' });
}

export function useAdminProfessionalApplication(id: string | undefined) {
  return useQuery({ queryKey: [...adminProfessionalApplicationsQueryKey, id], queryFn: () => getAdminProfessionalApplication(id!), enabled: Boolean(id), staleTime: 0, refetchOnMount: 'always', retry: false });
}

export function useReviewProfessionalApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'approved' | 'denied'; reason?: string }) => reviewProfessionalApplication(id, status, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminProfessionalApplicationsQueryKey }),
  });
}

export function useInviteAdmin() {
  return useMutation({ mutationFn: inviteAdmin });
}
