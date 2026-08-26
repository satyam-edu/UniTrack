import { createClient } from '@supabase/supabase-js'

/** Build an authenticated supabase-js client from a hand-off token, for use in Server Actions. */
export function buildAuthedClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}
