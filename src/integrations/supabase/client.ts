import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set. See .env.example.',
  );
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseKey,
  {
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);