// Mobile-side check for whether the signed-in account is also bound to a
// `web_access_contacts` row with admin/cskh access — the same accounts
// TheraHOME WEB treats as staff (see `current_web_roles()`, the RPC
// WEB's `webAccess.ts` calls). An admin/cskh Google account can be signed
// into the patient app too; when it is, the chat FAB switches from the
// single-specialist thread to the staff conversations list. See CLAUDE.md.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useWebRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ['web_roles', userId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('current_web_roles');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIsStaff(userId: string | undefined): boolean {
  const roles = useWebRoles(userId).data ?? [];
  return roles.includes('admin') || roles.includes('cskh');
}
