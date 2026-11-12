import { useEffect, useState } from 'react'
import { Button, Dialog, Field, IconButton } from '../ui.jsx'
import { EditIcon, DeleteIcon, CheckIcon } from '../icons.jsx'

export function NewFolderDialog ({ open, onClose, onAdd }) {
  const [name, setName] = useState('')
  useEffect(() => { if (open) setName('') }, [open])

  const submit = () => {
    const n = name.trim()
    if (n) onAdd(n).then(onClose)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New folder"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="filled" disabled={!name.trim()} onClick={submit}>Create</Button>
        </>
      }
    >
      <Field label="Name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
    </Dialog>
  )
}

export default function FolderManager ({ open, folders, onClose, onRename, onDelete }) {
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState('')

  const commitRename = () => {
    const f = folders.find(x => x.id === editId)
    const n = draft.trim()
    if (f && n && n !== f.name) onRename(f)(n)
    setEditId(null)
  }

  const sorted = [...folders].sort((a, b) => a.order - b.order)
  return (
    <Dialog open={open} onClose={onClose} title="Folders" actions={<Button variant="filled" onClick={onClose}>Done</Button>}>
      <div className="flex flex-col gap-2">
        {sorted.map(f =>
          editId === f.id ? (
            <div key={f.id} className="flex items-center gap-2">
              <Field
                className="flex-1"
                label="Rename"
                value={draft}
                autoFocus
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && commitRename()}
              />
              <IconButton variant="tonal" aria-label="Save name" onClick={commitRename}>
                <CheckIcon />
              </IconButton>
            </div>
          ) : (
            <div key={f.id} className="flex h-14 items-center gap-1 rounded-xl bg-surface-container pr-1 pl-4">
              <span className="min-w-0 flex-1 truncate text-base">{f.name}</span>
              <IconButton aria-label={`Rename ${f.name}`} onClick={() => { setEditId(f.id); setDraft(f.name) }}>
                <EditIcon />
              </IconButton>
              <IconButton
                disabled={f.id === 'inbox'}
                aria-label={`Delete ${f.name}`}
                title={f.id === 'inbox' ? 'The default folder cannot be deleted' : undefined}
                onClick={() => onDelete(f)}
              >
                <DeleteIcon />
              </IconButton>
            </div>
          ),
        )}
      </div>
    </Dialog>
  )
}
