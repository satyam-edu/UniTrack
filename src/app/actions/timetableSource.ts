'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { buildAuthedClient } from '@/lib/supabase-with-token'

const BUCKET = 'timetable-sources'

/**
 * Uploads the original timetable image/PDF to storage and records it as the
 * user's current source. Best-effort from the caller's side — a failure here
 * must never block the timetable import itself.
 */
export async function saveTimetableSource(formData: FormData): Promise<{ success: boolean }> {
  const token = formData.get('token') as string | null
  if (!token) return { success: false }

  const { data: { user }, error: authError } = await buildAuthedClient(token).auth.getUser()
  if (authError || !user) return { success: false }

  const file = formData.get('file') as File | null
  if (!file) return { success: false }

  const arrayBuffer = await file.arrayBuffer()
  const ext = file.type === 'application/pdf' ? 'pdf' : (file.type.split('/')[1] || 'bin')
  const path = `${user.id}/source.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(arrayBuffer), { contentType: file.type, upsert: true })

  if (uploadError) return { success: false }

  const { error: dbError } = await supabaseAdmin.from('timetable_source').upsert({
    user_id: user.id,
    storage_path: path,
    mime_type: file.type,
    uploaded_at: new Date().toISOString(),
  })

  return { success: !dbError }
}

/** Returns a short-lived signed URL for the caller's stored timetable source, if any. */
export async function getTimetableSourceUrl(token: string): Promise<{ url: string; mimeType: string } | null> {
  if (!token) return null

  const { data: { user }, error: authError } = await buildAuthedClient(token).auth.getUser()
  if (authError || !user) return null

  const { data: row } = await supabaseAdmin
    .from('timetable_source')
    .select('storage_path, mime_type')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!row) return null

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 300)

  if (signError || !signed) return null

  return { url: signed.signedUrl, mimeType: row.mime_type }
}
