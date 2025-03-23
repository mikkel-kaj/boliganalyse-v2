import {createClient} from "@supabase/supabase-js";
import {config} from "../config/config.ts";

const supabaseUrl = config.supabase.url;
const supabaseKey = config.supabase.serviceRoleKey;

export const supabase_private = createClient(
  supabaseUrl,
  supabaseKey,
  { db: { schema: "private" } },
);
