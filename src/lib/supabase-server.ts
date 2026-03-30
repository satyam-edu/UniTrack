import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// This client bypasses RLS — use ONLY on the server for privileged operations
// (e.g., looking up a user's email by enrollment number before they are authenticated)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)
