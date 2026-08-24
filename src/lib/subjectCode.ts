/**
 * Normalise a subject code for catalog lookup/storage: uppercase, whitespace
 * stripped. Unlike subject-identity dedup, the trailing T/P suffix is kept —
 * "ITE425T" and "ITE425P" are different catalog rows (Theory vs Lab).
 */
export function normaliseSubjectCode(code: string): string {
  return (code ?? '').replace(/\s+/g, '').toUpperCase()
}

/**
 * Strips a trailing Theory/Lab type marker from an already-normalised code,
 * grouping siblings like "ITE425T"/"ITE425P" or "BP207(T)"/"BP207(P)" under
 * the same base ("ITE425", "BP207") — same subject, different delivery mode.
 * Used only to power "copy the name from its sibling" suggestions in the
 * naming UI; subject identity itself stays code-first and per-suffix.
 */
export function getSubjectBaseCode(normalisedCode: string): string {
  return normalisedCode
    .replace(/\((P|T)\)$/i, '')
    .replace(/(\d)(P|T)$/i, '$1')
}
