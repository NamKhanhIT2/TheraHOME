import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** The single phone/email this authenticated account has claimed. */
export function useAccessContact(userId: string | undefined) {
  return useQuery({
    queryKey: ['user_access_contact', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_access_contacts')
        .select('contact_type, contact_value')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

