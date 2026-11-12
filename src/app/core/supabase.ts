import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

function createConfiguredClient(): SupabaseClient {
  if (!environment.supabaseUrl || !environment.supabaseAnonKey) {
    throw new Error(
      'Supabase no está configurado. Define supabaseUrl y supabaseAnonKey en src/environments/environment.ts.'
    );
  }

  return createClient(environment.supabaseUrl, environment.supabaseAnonKey);
}

export const supabaseClient = createConfiguredClient();

export function createSupabaseClient(): SupabaseClient {
  return supabaseClient;
}
