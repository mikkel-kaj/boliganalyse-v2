import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client that connects to the local Docker instance
 * This allows testing against a real database without needing to set environment variables
 */
export function createLocalSupabaseClient(): SupabaseClient {
  const supabaseUrl = "http://127.0.0.1:64321";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
  
  return createClient(supabaseUrl, supabaseKey);
} 