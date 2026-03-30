'use server'

import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Looks up the email associated with an enrollment number.
 * Uses the Supabase Admin client (service role key) to bypass RLS,
 * since the user is not yet authenticated at login time.
 */
export async function lookupEmailByEnrollment(
  enrollmentNo: string
): Promise<{ email?: string; error?: string }> {
  if (!enrollmentNo || enrollmentNo.trim() === '') {
    return { error: 'Enrollment number is required.' }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('enrollment_no', enrollmentNo.trim())
      .single()

    if (error || !data) {
      return { error: 'No account found with this enrollment number.' }
    }

    return { email: data.email }
  } catch {
    return { error: 'No account found with this enrollment number.' }
  }
}
