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

/**
 * Checks whether an email address is registered in the system.
 * Uses the admin client to query the public users table (bypasses RLS).
 * Returns true if a matching record exists, false otherwise.
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  if (!email || email.trim() === '') return false

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (error) return false
    return data !== null
  } catch {
    return false
  }
}

/**
 * Securly deletes a user account using Supabase admin client.
 */
export async function deleteUserAccount(userId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    // Step 1: Delete the auth user first — if this fails, DB record is untouched
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authError) {
      return { success: false, error: authError.message }
    }

    // Step 2: Delete the DB record only after auth is confirmed gone
    const { error: dbError } = await supabaseAdmin.from('users').delete().eq('id', userId)
    if (dbError) {
      console.error('[deleteUserAccount] DB cleanup failed after auth deletion:', dbError)
      // Auth is already deleted so the account is effectively gone — treat as success
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete user account.' }
  }
}
