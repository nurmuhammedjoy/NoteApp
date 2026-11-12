// Cut at a word boundary, never mid-word. Falls back to a hard cut for one giant word.
export const cutWords = (s, max) => {
  if (s.length <= max) return s
  const head = s.slice(0, max + 1)
  const i = head.search(/\s\S*$/)
  return (i > 0 ? head.slice(0, i) : s.slice(0, max)).trimEnd()
}

// Start an excerpt ~`lead` chars before `hit`, backed up to the start of a word.
export const excerptFrom = (s, hit, lead = 20) => {
  let start = Math.max(0, hit - lead)
  while (start > 0 && !/\s/.test(s[start - 1])) start--
  return start ? '…' + s.slice(start) : s
}
