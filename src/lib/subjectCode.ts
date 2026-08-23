/**
 * Normalise a subject code for catalog lookup/storage: uppercase, whitespace
 * stripped. Unlike subject-identity dedup, the trailing T/P suffix is kept —
 * "ITE425T" and "ITE425P" are different catalog rows (Theory vs Lab).
 */
export function normaliseSubjectCode(code: string): string {
  return (code ?? '').replace(/\s+/g, '').toUpperCase()
}
