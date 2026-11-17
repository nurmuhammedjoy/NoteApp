import { useEffect, useState } from 'react'
import { Button, Dialog, Field, IconButton } from '../ui.jsx'
import { AddIcon, EditIcon, DeleteIcon, CheckIcon, CloseIcon, FolderOpenIcon } from '../icons.jsx'

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
      <Field label="Name" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
    </Dialog>
  )
}

export default function FolderManager ({ open, folders, counts, onClose, onNew, onRename, onDelete }) {
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState('')
  useEffect(() => { if (!open) setEditId(null) }, [open])

  const commitRename = () => {
    const f = folders.find(x => x.id === editId)
    const n = draft.trim()
    if (f && n && n !== f.name) onRename(f)(n)
    setEditId(null)
  }

  const sorted = [...folders].sort((a, b) => a.order - b.order)
  return (
    <Dialog
      sheet
      open={open}
      onClose={onClose}
      title="Folders"
      actions={
        <>
          <Button variant="tonal" className="gap-2 pl-4" onClick={onNew}><AddIcon className="size-5" />New folder</Button>
          <Button variant="filled" onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="flex flex-col gap-0.5 [&>*]:rounded-[6px] [&>*:first-child]:rounded-t-[24px] [&>*:last-child]:rounded-b-[24px]">
        {sorted.map(f => {
          const n = counts[f.id] || 0
          return editId === f.id ? (
            <div key={f.id} className="flex items-center gap-1 bg-surface-container p-2 pl-3">
              <Field
                className="min-w-0 flex-1"
                label="Rename"
                value={draft}
                autoFocus
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { e.stopPropagation(); setEditId(null) } }}
              />
              <IconButton variant="tonal" aria-label="Save name" onClick={commitRename}><CheckIcon /></IconButton>
              <IconButton aria-label="Cancel rename" onClick={() => setEditId(null)}><CloseIcon /></IconButton>
            </div>
          ) : (
            <div key={f.id} className="flex min-h-[68px] items-center gap-3 bg-surface-container py-2 pr-1 pl-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary-container text-on-secondary-container [&>svg]:size-6">
                <FolderOpenIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium">{f.name}</span>
                <span className="block text-sm text-on-surface-variant">
                  {f.id === 'inbox' ? 'Default · ' : ''}{n} snippet{n === 1 ? '' : 's'}
                </span>
              </span>
              <IconButton aria-label={`Rename ${f.name}`} onClick={() => { setEditId(f.id); setDraft(f.name) }}>
                <EditIcon />
              </IconButton>
              {f.id !== 'inbox' && (
                <IconButton aria-label={`Delete ${f.name}`} onClick={() => onDelete(f)}>
                  <DeleteIcon />
                </IconButton>
              )}
            </div>
          )
        })}
      </div>
    </Dialog>
  )
}
