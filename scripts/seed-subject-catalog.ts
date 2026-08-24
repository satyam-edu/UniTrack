/**
 * One-off/reusable loader for a batch's subject-code catalog.
 *
 * Usage:
 *   npx tsx scripts/seed-subject-catalog.ts <batch> <path-to.json>
 *
 * The JSON file is an array of { code, name, type } entries, e.g.:
 *   [
 *     { "code": "ITE425T", "name": "Software Engineering", "type": "Theory" },
 *     { "code": "ITE425P", "name": "Software Engineering Lab", "type": "Lab" }
 *   ]
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — read from
 * .env.local in the project root if present, or from the environment.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}

interface CatalogRow {
  code: string
  name: string
  type?: 'Theory' | 'Lab'
}

async function main() {
  const [batch, filePath] = process.argv.slice(2)
  if (!batch || !filePath) {
    console.error('Usage: npx tsx scripts/seed-subject-catalog.ts <batch> <path-to.json>')
    process.exit(1)
  }

  loadEnvLocal()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (checked .env.local and the environment).')
    process.exit(1)
  }

  const rows: CatalogRow[] = JSON.parse(readFileSync(resolve(filePath), 'utf8'))
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('Input file must be a non-empty JSON array of { code, name, type }.')
    process.exit(1)
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const catalogRows = rows.map((r) => ({
    batch,
    subject_code: r.code.replace(/\s+/g, '').toUpperCase(),
    subject_name: r.name.trim(),
    type: r.type ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabaseAdmin
    .from('subject_catalog')
    .upsert(catalogRows, { onConflict: 'batch,subject_code' })

  if (error) {
    console.error('Upsert failed:', error.message)
    process.exit(1)
  }

  console.log(`Seeded ${catalogRows.length} subject_catalog rows for batch "${batch}".`)
}

main()
