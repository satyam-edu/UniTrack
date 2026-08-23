'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { buildAuthedClient } from '@/lib/supabase-with-token'
import { normaliseSubjectCode } from '@/lib/subjectCode'

export interface CatalogEntry {
  subject_name: string
  type: string | null
}

/** Map of normalised subject_code -> catalog entry. Codes with no match are simply absent. */
export type CatalogResolution = Record<string, CatalogEntry>

/**
 * Resolves subject codes against the caller's batch-scoped catalog, so a
 * timetable scan can pre-fill names for codes a previous student of the
 * same batch has already named.
 */
export async function resolveSubjectCodes(
  codes: string[],
  token: string
): Promise<CatalogResolution> {
  if (!token) throw new Error('You must be logged in.')

  const { data: { user }, error: authError } = await buildAuthedClient(token).auth.getUser()
  if (authError || !user) throw new Error('Invalid or expired session.')

  const normalisedCodes = Array.from(
    new Set(codes.map(normaliseSubjectCode).filter(Boolean))
  )
  if (normalisedCodes.length === 0) return {}

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('batch')
    .eq('id', user.id)
    .single()

  const batch = profile?.batch?.trim()
  if (!batch) return {}

  const { data: rows } = await supabaseAdmin
    .from('subject_catalog')
    .select('subject_code, subject_name, type')
    .eq('batch', batch)
    .in('subject_code', normalisedCodes)

  const resolution: CatalogResolution = {}
  for (const row of rows ?? []) {
    resolution[row.subject_code] = { subject_name: row.subject_name, type: row.type }
  }
  return resolution
}
