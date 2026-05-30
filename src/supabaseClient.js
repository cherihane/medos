import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yehqmvwmosskumbegzty.supabase.co";
const supabaseKey =
  "sb_publishable_d0hgwt-SF7pzOswk-JVvZA_CkLm-4nI";

export const supabase = createClient(supabaseUrl, supabaseKey);
