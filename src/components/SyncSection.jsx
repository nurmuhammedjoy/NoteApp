import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Field } from '../ui.jsx'
import { DownloadIcon, FolderOpenIcon, UploadIcon, CloseIcon } from '../icons.jsx'
import { CLIENT_ID, completeSignIn, getSession, pollForToken, signOut, startDeviceFlow } from '../github/auth.js'
import { createMyRepo, listMyRepos, selectRepo } from '../github/repository.js'
import { syncNow } from '../github/sync.js'
import { copyText } from '../db.js'
import { Group, Row } from './Settings.jsx'

const when = ts => (ts ? `Last synced ${new Date(ts).toLocaleString()}` : 'Not synced yet')

// "GitHub sync" group of the Settings tab. Owns its own small state; results go out as toasts.
export default function SyncSection ({ onToast }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = signed out
  const [flow, setFlow] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tokenOpen, setTokenOpen] = useState(false)
  const [token, setToken] = useState('')
  const [repoOpen, setRepoOpen] = useState(false)
  const [repos, setRepos] = useState(null)
  const [newName, setNewName] = useState('note-sync')
  const abort = useRef(null)

  const refresh = () => getSession().then(setSession)
  useEffect(() => {
    refresh()
    return () => abort.current?.abort()
  }, [])

  const fail = e => e.name !== 'AbortError' && onToast(e.message)

  const signIn = async () => {
    const ctl = new AbortController()
    abort.current = ctl
    try {
      const f = await startDeviceFlow()
      setFlow(f)
      await completeSignIn(await pollForToken(f, ctl.signal))
      await refresh()
      onToast('Signed in.')
    } catch (e) {
      fail(e)
    } finally {
      setFlow(null)
    }
  }

  const useToken = () =>
    completeSignIn(token.trim())
      .then(() => { setToken(''); setTokenOpen(false); return refresh() })
      .then(() => onToast('Signed in.'), fail)

  const openRepos = () => {
    setRepoOpen(true)
    setRepos(null)
    listMyRepos().then(setRepos, e => { setRepos([]); fail(e) })
  }

  const choose = repo =>
    selectRepo(repo)
      .then(() => { setRepoOpen(false); return refresh() })
      .then(() => onToast(`Using ${repo.owner}/${repo.name}.`), fail)

  const create = () => createMyRepo(newName.trim()).then(choose, fail)

  const sync = async () => {
    setBusy(true)
    try {
      await syncNow()
      onToast('Synced.')
    } catch (e) {
      onToast(e.message)
    } finally {
      setBusy(false)
      refresh()
    }
  }

  if (session === undefined) return null

  return (
    <Group label="GitHub sync">
      {!session && !flow && (
        <>
          <Row
            icon={<DownloadIcon />}
            title="Sign in with GitHub"
            text={CLIENT_ID ? 'Device code, no password needed' : 'Set CLIENT_ID in src/github/auth.js first'}
            onClick={signIn}
          />
          <Row icon={<FolderOpenIcon />} tone="bg-tertiary-container text-on-tertiary-container" title="Use an access token" text="Paste a personal access token" onClick={() => setTokenOpen(true)} />
        </>
      )}

      {flow && (
        <div className="flex flex-col gap-3 bg-surface-container p-4">
          <p className="text-sm text-on-surface-variant">Open GitHub and enter this code:</p>
          <p className="text-center font-mono text-3xl font-medium tracking-widest text-on-surface select-all">{flow.userCode}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => copyText(flow.userCode).then(() => onToast('Copied.'), () => onToast('Copy failed.'))}>Copy code</Button>
            <Button variant="tonal" onClick={() => window.open(flow.verificationUri, '_blank', 'noopener')}>Open GitHub</Button>
            <Button onClick={() => abort.current?.abort()}>Cancel</Button>
          </div>
          <p className="text-xs text-on-surface-variant">Waiting for approval…</p>
        </div>
      )}

      {session && (
        <>
          <div className="bg-surface-container p-4">
            <p className="text-base font-medium text-on-surface">Signed in as {session.user?.login}</p>
            <p className="text-sm text-on-surface-variant">{session.repo ? when(session.lastSyncAt) : 'Choose a repository to start syncing'}</p>
          </div>
          <Row
            icon={<FolderOpenIcon />}
            title={session.repo ? 'Repository' : 'Choose repository'}
            text={session.repo ? `${session.repo.owner}/${session.repo.name}` : 'Pick a private repo or create one'}
            onClick={openRepos}
          />
          {session.repo && (
            <Row icon={<UploadIcon />} title={busy ? 'Syncing…' : 'Sync now'} text="Pull, merge and push" onClick={() => !busy && sync()} />
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
        actions={<><Button onClick={() => setTokenOpen(false)}>Cancel</Button><Button variant="filled" disabled={!token.trim()} onClick={useToken}>Sign in</Button></>}
      >
        <p className="text-sm text-on-surface-variant">A fine-grained token with Contents: read and write on your sync repo, or a classic token with the repo scope. It stays in this browser only.</p>
        <Field label="Token" type="password" autoComplete="off" spellCheck={false} value={token} onChange={e => setToken(e.target.value)} />
      </Dialog>

      <Dialog sheet open={repoOpen} onClose={() => setRepoOpen(false)} title="Sync repository" actions={<Button onClick={() => setRepoOpen(false)}>Close</Button>}>
        <div className="flex flex-col gap-2">
          {repos === null && <p className="text-sm text-on-surface-variant">Loading your private repositories…</p>}
          {repos?.length === 0 && <p className="text-sm text-on-surface-variant">No private repositories found.</p>}
          {repos?.map(r => (
            <button
              key={`${r.owner}/${r.name}`}
              type="button"
              onClick={() => choose(r)}
              className="cursor-pointer rounded-[20px] bg-surface-container p-4 text-left text-base text-on-surface outline-none hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary"
            >
              {r.owner}/{r.name}
            </button>
          ))}
        </div>
        <Field label="Or create a new private repo" value={newName} onChange={e => setNewName(e.target.value)} />
        <Button variant="tonal" disabled={!newName.trim()} onClick={create}>Create and use</Button>
      </Dialog>
    </Group>
  )
}
