import { useEffect, useMemo, useState } from 'react'
import { Button, Dialog, Field } from '../ui.jsx'
import { CheckIcon, CloseIcon, FolderOpenIcon, SyncIcon } from '../icons.jsx'
import { completeSignIn, getSession, signOut } from '../github/auth.js'
import { createMyRepo, listMyRepos, selectRepo } from '../github/repository.js'
import { onSyncEvent, syncNow } from '../github/sync.js'
import { Group, Row } from './Settings.jsx'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'
const REPO_NAME = /^[\w.-]+$/

const ago = ts => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

const Spinner = ({ className = 'size-6' }) => <SyncIcon className={`${className} animate-spin`} />

// "GitHub sync" group of the Settings tab. Owns its own small state; results go out as toasts.
export default function SyncSection ({ onToast }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = signed out
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)
  const [tokenOpen, setTokenOpen] = useState(false)
  const [token, setToken] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const [repoOpen, setRepoOpen] = useState(false)
  const [repos, setRepos] = useState(null)
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('note-sync')
  const [pending, setPending] = useState(null) // repo key being selected / created

  const refresh = () => getSession().then(setSession)
  useEffect(() => { refresh() }, [])
  // Auto-sync finishes in the background: keep "Synced …" honest. Also re-render the relative time.
  useEffect(() => onSyncEvent(() => refresh()), [])
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const fail = e => onToast(e.message)

  const useToken = () => {
    if (signingIn || !token.trim()) return
    setSigningIn(true)
    return completeSignIn(token.trim())
      .then(() => { setToken(''); setTokenOpen(false); return refresh() })
      .then(() => onToast('Signed in.'), fail)
      .finally(() => setSigningIn(false))
  }

  const openRepos = () => {
    setRepoOpen(true)
    setRepos(null)
    setQuery('')
    listMyRepos().then(setRepos, e => { setRepos([]); fail(e) })
  }

  const choose = repo => {
    if (pending) return
    setPending(`${repo.owner}/${repo.name}`)
    return selectRepo(repo)
      .then(() => { setRepoOpen(false); return refresh() })
      .then(() => onToast(`Using ${repo.owner}/${repo.name}.`), fail)
      .finally(() => setPending(null))
  }

  const name = newName.trim()
  const exists = repos?.some(r => r.name.toLowerCase() === name.toLowerCase())
  const nameError = name && !REPO_NAME.test(name)
    ? 'Letters, numbers, dots, dashes and underscores only.'
    : exists ? 'You already have a repo with this name. Pick it above.' : ''
  const canCreate = !!name && !nameError && !pending

  const create = () => {
    if (!canCreate) return
    setPending('__new')
    return createMyRepo(name)
      .then(r => { setPending(null); return choose(r) }, e => { setPending(null); fail(e) })
  }

  const sync = async () => {
    setBusy(true)
    try {
      const r = await syncNow()
      onToast(r.skipped ? 'Choose a repository first.' : 'Synced.')
    } catch (e) {
      onToast(e.message)
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (repos || []).filter(r => !q || `${r.owner}/${r.name}`.toLowerCase().includes(q))
  }, [repos, query])

  if (session === undefined) return null

  const current = session?.repo && `${session.repo.owner}/${session.repo.name}`
  const status = busy
    ? 'Syncing…'
    : !session?.repo ? 'Choose a repository to start syncing'
      : session.lastSyncAt ? `Synced ${ago(session.lastSyncAt)}` : 'Not synced yet'

  return (
    <Group label="GitHub sync">
      {!session && (
        <>
          <div className="bg-surface-container p-4">
            <p className="text-base font-medium text-on-surface">Keep your snippets in a private repo</p>
            <p className="pt-1 text-sm text-on-surface-variant">Sync between devices through your own GitHub account. Nothing goes anywhere else.</p>
          </div>
          <Row icon={<FolderOpenIcon />} tone="bg-tertiary-container text-on-tertiary-container" title="Sign in with an access token" text="Paste a personal access token" onClick={() => setTokenOpen(true)} />
        </>
      )}

      {session && (
        <>
          <div className="flex items-center gap-4 bg-surface-container p-4">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-xl font-medium text-on-primary">
              {(session.user?.login || '?')[0].toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-on-surface">{session.user?.login}</p>
              <p className="truncate text-sm text-on-surface-variant" title={session.lastSyncAt ? new Date(session.lastSyncAt).toLocaleString() : undefined} aria-live="polite">{status}</p>
            </div>
            {session.repo && (
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary-container text-on-secondary-container">
                {busy ? <Spinner className="size-5" /> : session.lastSyncAt ? <CheckIcon className="size-5" /> : <SyncIcon className="size-5" />}
              </span>
            )}
          </div>
          <Row
            icon={<FolderOpenIcon />}
            title={session.repo ? 'Repository' : 'Choose repository'}
            text={current || 'Pick a private repo or create one'}
            onClick={openRepos}
          />
          {session.repo && (
            <Row
              icon={busy ? <Spinner /> : <SyncIcon />}
              title={busy ? 'Syncing…' : 'Sync now'}
              text="Pull, merge and push"
              disabled={busy}
              trailing={null}
              onClick={sync}
            />
          )}
          <Row
            icon={<CloseIcon />}
            tone="bg-error-container text-on-error-container"
            title="Sign out"
            text="Forget the token on this device"
            onClick={() => signOut().then(refresh).then(() => onToast('Signed out.'))}
          />
        </>
      )}

      <Dialog
        open={tokenOpen}
        onClose={() => setTokenOpen(false)}
        title="Access token"
        actions={<><Button onClick={() => setTokenOpen(false)}>Cancel</Button><Button variant="filled" disabled={!token.trim() || signingIn} onClick={useToken}>{signingIn ? 'Checking…' : 'Sign in'}</Button></>}
      >
        <p className="text-sm text-on-surface-variant">
          Use a fine-grained token with <b className="font-medium text-on-surface">Contents: read and write</b> on your sync repo, or a classic token with the <b className="font-medium text-on-surface">repo</b> scope. It stays in this browser only.
        </p>
        <a href={TOKEN_URL} target="_blank" rel="noreferrer noopener" className="w-fit text-sm font-medium text-primary underline-offset-2 hover:underline">Create a token on GitHub</a>
        <Field label="Token" type="password" autoComplete="off" spellCheck={false} value={token} onChange={e => setToken(e.target.value)} onKeyDown={e => e.key === 'Enter' && useToken()} />
      </Dialog>

      <Dialog
        sheet
        open={repoOpen}
        onClose={() => setRepoOpen(false)}
        title="Sync repository"
        footer={
          <div className="flex flex-col gap-3 border-t border-outline-variant pt-4">
            <div className="flex items-start gap-2">
              <Field className="min-w-0 flex-1" label="New private repository" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} hint={nameError || undefined} spellCheck={false} autoCapitalize="none" />
              <Button variant="filled" className="mt-1 h-12" disabled={!canCreate} onClick={create}>{pending === '__new' ? 'Creating…' : 'Create'}</Button>
            </div>
          </div>
        }
        actions={<Button onClick={() => setRepoOpen(false)}>Close</Button>}
      >
        <p className="text-sm text-on-surface-variant">Your snippets are stored as plain files in one private repository.</p>
        {repos?.length > 6 && <Field label="Filter repositories" value={query} onChange={e => setQuery(e.target.value)} spellCheck={false} autoCapitalize="none" />}
        <div className="flex flex-col gap-0.5 [&>*]:rounded-[6px] [&>*:first-child]:rounded-t-[20px] [&>*:last-child]:rounded-b-[20px]" role="list">
          {repos === null && [0, 1, 2].map(i => <div key={i} className="h-[68px] animate-pulse bg-surface-container" />)}
          {repos && shown.length === 0 && (
            <p className="rounded-[20px] bg-surface-container p-4 text-sm text-on-surface-variant">
              {repos.length === 0 ? 'No private repositories yet. Create one below.' : 'No repository matches that filter.'}
            </p>
          )}
          {shown.map(r => {
            const key = `${r.owner}/${r.name}`
            const on = key === current
            return (
              <button
                key={key}
                role="listitem"
                type="button"
                disabled={!!pending}
                aria-current={on || undefined}
                onClick={() => choose(r)}
                className="flex min-h-[68px] w-full cursor-pointer items-center gap-3 bg-surface-container py-2 pr-4 pl-3 text-left outline-none transition-colors hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:opacity-60"
              >
                <span className={`grid size-11 shrink-0 place-items-center rounded-2xl [&>svg]:size-6 ${on ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-secondary-container'}`}>
                  {pending === key ? <Spinner /> : on ? <CheckIcon /> : <FolderOpenIcon />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-on-surface">{r.name}</span>
                  <span className="block truncate text-sm text-on-surface-variant">{r.owner}{on ? ' · In use' : ''}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Dialog>
    </Group>
  )
}
