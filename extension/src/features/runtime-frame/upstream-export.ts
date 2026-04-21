export interface UpstreamExportManifest {
  htmlEntry: string
  files: string[]
  generatedAt: string | null
  sourceDir: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizeUpstreamExportManifest(value: unknown): UpstreamExportManifest | null {
  if (!isRecord(value)) return null
  if (typeof value.htmlEntry !== 'string') return null
  if (!Array.isArray(value.files) || !value.files.every((file) => typeof file === 'string')) return null

  return {
    htmlEntry: value.htmlEntry,
    files: value.files,
    generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : null,
    sourceDir: typeof value.sourceDir === 'string' ? value.sourceDir : null,
  }
}

export function resolveUpstreamExportUrl(manifest: UpstreamExportManifest, basePath = '/upstream/hurrycurry-web/') {
  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`
  const relativeEntry = manifest.htmlEntry.startsWith('/') ? manifest.htmlEntry.slice(1) : manifest.htmlEntry
  return `${normalizedBasePath}${relativeEntry}`
}
