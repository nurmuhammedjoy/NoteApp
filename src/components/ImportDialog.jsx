import { Button, Dialog } from '../ui.jsx'
import { DownloadIcon, UploadIcon } from '../icons.jsx'

const Choice = ({ icon, tone, title, text, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full cursor-pointer items-center gap-4 rounded-[20px] p-4 text-left outline-none transition-[filter,transform] hover:brightness-95 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary [&>svg]:size-6 [&>svg]:shrink-0 ${tone}`}
  >
    {icon}
    <span>
      <span className="block text-base font-medium">{title}</span>
      <span className="block text-sm opacity-80">{text}</span>
    </span>
  </button>
)

export default function ImportDialog ({ data, onCancel, onMerge, onReplace }) {
  const f = data?.folders.length ?? 0
  const s = data?.snippets.length ?? 0
  return (
    <Dialog sheet open={!!data} onClose={onCancel} title="Import library" actions={<Button onClick={onCancel}>Cancel</Button>}>
      <p className="text-sm text-on-surface-variant">
        Found {f} folder{f === 1 ? '' : 's'} and {s} snippet{s === 1 ? '' : 's'} in this file.
      </p>
      <div className="flex flex-col gap-2">
        <Choice
          icon={<DownloadIcon />}
          tone="bg-primary-container text-on-primary-container"
          title="Merge"
          text="Keep your library, add and update from this file"
          onClick={onMerge}
        />
        <Choice
          icon={<UploadIcon />}
          tone="bg-tertiary-container text-on-tertiary-container"
          title="Replace all"
          text="Delete everything first, then import"
          onClick={onReplace}
        />
      </div>
    </Dialog>
  )
}
