import { Button, Dialog } from '../ui.jsx'

export default function ImportDialog ({ data, onCancel, onMerge, onReplace }) {
  return (
    <Dialog
      open={!!data}
      onClose={onCancel}
      title="Import"
      actions={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="outlined" onClick={onReplace}>Replace all</Button>
          <Button variant="filled" onClick={onMerge}>Merge</Button>
        </>
      }
    >
      <p className="text-sm text-on-surface-variant">
        Found <b>{data?.folders.length ?? 0}</b> folder(s) and <b>{data?.snippets.length ?? 0}</b> snippet(s).
        <br />
        <b>Merge</b> keeps your library and adds/updates from this file. <b>Replace all</b> deletes everything first.
      </p>
    </Dialog>
  )
}
