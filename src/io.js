// Import/export. Portable format: one .zip with `metadata.json` (metadata only)
// and one plain .txt file per snippet. A bare .json backup is also accepted.
import JSZip from 'jszip'
import { DEFAULT_FOLDER } from './db.js'

const META = 'metadata.json'

export async function exportArchive (folders, snippets) {
  const zip = new JSZip()
  const meta = {
    app: 'note',
    version: 1,
    exportedAt: new Date().toISOString(),
    folders,
    snippets: [],
  }
  snippets.forEach((s, i) => {
    const file = `snippets/${String(i + 1).padStart(3, '0')}-${slug(s.title || s.text || 'snippet')}.txt`
    zip.file(file, s.text)
    // Metadata keeps only pointers; snippet content lives in the .txt file.
    const { text, ...rest } = s
    meta.snippets.push({ ...rest, file })
  })
  zip.file(META, JSON.stringify(meta, null, 2))
  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `note-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export async function readArchive (file) {
  let meta
  if (file.name.toLowerCase().endsWith('.json')) {
    meta = JSON.parse(await file.text())
    meta.snippets = meta.snippets.map(s => ({ ...s, text: s.text || '' }))
  } else {
    const zip = await JSZip.loadAsync(file)
    meta = JSON.parse(await zip.file(META).async('string'))
    for (const s of meta.snippets) {
      const f = zip.file(s.file)
      s.text = f ? await f.async('string') : ''
      delete s.file
    }
  }
  if (!Array.isArray(meta.folders) || !Array.isArray(meta.snippets)) throw new Error('Unrecognized file')
  if (!meta.folders.some(f => f.id === DEFAULT_FOLDER)) {
    meta.folders.push({ id: DEFAULT_FOLDER, name: 'Inbox', order: 0, createdAt: Date.now() })
  }
  for (const s of meta.snippets) {
    if (!s || typeof s.id !== 'string' || !s.id) throw new Error('Invalid snippet metadata')
    s.text = typeof s.text === 'string' ? s.text : ''
    s.title = typeof s.title === 'string' && s.title.trim()
      ? s.title
      : s.text.trim().split('\n')[0].slice(0, 64)
    if (!meta.folders.some(f => f.id === s.folderId)) s.folderId = DEFAULT_FOLDER
  }
  return meta
}

function slug (s) {
  let out = ''
  for (const ch of s.trim().toLowerCase().replace(/\s+/g, '-')) {
    if (/[a-z0-9]/.test(ch)) out += ch
    else if (out && !out.endsWith('-')) out += '-'
    if (out.length >= 40) break
  }
  return out.replace(/^[-]+|[-]+$/g, '') || 'snippet'
}
