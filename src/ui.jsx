// Tiny Material 3 component kit, plain Tailwind. Colors come from the role
// tokens in index.css, so everything follows light/dark automatically.
import { forwardRef, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AddIcon, CheckIcon, CloseIcon, ExpandMoreIcon, MoreVertIcon } from './icons.jsx'

const cx = (...a) => a.filter(Boolean).join(' ')

const iconVariants = {
  standard: 'text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12',
  tonal: 'bg-secondary-container text-on-secondary-container hover:opacity-90 active:opacity-80',
}
export const IconButton = forwardRef(({ variant = 'standard', className, ...p }, ref) => (
  <motion.button
    whileTap={{ scale: 0.88 }}
    ref={ref}
    type="button"
    className={cx('inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-38 [&>svg]:size-6', iconVariants[variant], className)}
    {...p}
  />
))

const buttonVariants = {
  text: 'text-primary hover:bg-primary/8 active:bg-primary/12',
  outlined: 'border border-outline text-primary hover:bg-primary/8 active:bg-primary/12',
  tonal: 'bg-secondary-container text-on-secondary-container hover:opacity-90',
  filled: 'bg-primary text-on-primary hover:shadow-md hover:opacity-95',
}
export const Button = ({ variant = 'text', className, ...p }) => (
  <button
    type="button"
    className={cx('inline-flex h-10 cursor-pointer items-center justify-center rounded-full px-6 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:border-transparent disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-none', buttonVariants[variant], className)}
    {...p}
  />
)

export const Fab = ({ className, ...p }) => (
  <motion.button
    whileTap={{ scale: 0.92 }}
    type="button"
    className={cx('inline-flex size-14 cursor-pointer items-center justify-center rounded-2xl bg-primary-container text-on-primary-container shadow-lg outline-none transition hover:shadow-xl focus-visible:ring-2 focus-visible:ring-primary [&>svg]:size-6', className)}
    {...p}
  />
)

// ⋮ button + popup menu. items: [{ label, icon, onSelect }]
export function MenuButton ({ label = 'More options', items }) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const away = e => !ref.current?.contains(e.target) && setOpen(false)
    const esc = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <IconButton
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={e => {
          setUp(window.innerHeight - e.currentTarget.getBoundingClientRect().bottom < items.length * 48 + 24)
          setOpen(o => !o)
        }}
      >
        <MoreVertIcon />
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.1 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            style={{ transformOrigin: up ? 'bottom right' : 'top right' }}
            className={cx('absolute right-0 z-40 min-w-44 rounded-2xl bg-surface-container-high py-2 shadow-lg', up ? 'bottom-full mb-1' : 'top-full mt-1')}
          >
            {items.map(i => (
              <button
                key={i.label}
                role="menuitem"
                type="button"
                onClick={() => { setOpen(false); i.onSelect() }}
                className="flex h-12 w-full cursor-pointer items-center gap-3 px-4 text-left text-base text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/12 [&>svg]:size-6 [&>svg]:text-on-surface-variant"
              >
                {i.icon}
                {i.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Native <dialog>: focus trap, Esc and backdrop come for free. `sheet` = bottom sheet.
export function Dialog ({ open, onClose, title, actions, sheet, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={e => e.target === e.currentTarget && onClose()}
      className={cx('m-auto max-h-[90dvh] overflow-hidden bg-surface-container-high p-0 text-on-surface backdrop:bg-scrim/40', sheet ? 'mt-auto mb-0 w-full max-w-xl rounded-t-[28px]' : 'w-[min(26rem,calc(100vw-2rem))] rounded-[28px]')}
    >
      <div className={cx('flex max-h-[90dvh] flex-col gap-4', sheet ? 'px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]' : 'p-6')}>
        {sheet && <div className="mx-auto h-1 w-8 shrink-0 rounded-full bg-on-surface-variant/40" />}
        <h2 className={cx('shrink-0', sheet ? 'text-[22px] leading-7' : 'text-2xl leading-8')}>{title}</h2>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain">{children}</div>
        {actions && <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div>}
      </div>
    </dialog>
  )
}

// Filled text field. as: 'input' | 'textarea' | 'select'
export const Field = forwardRef(({ as: Tag = 'input', label, hint, className, ...p }, ref) => (
  <label className={cx('group block', className)}>
    <div className="relative rounded-t-xl border-b-2 border-on-surface-variant bg-surface-container-highest px-4 pt-2 pb-2 transition-colors focus-within:border-primary">
      <span className="block text-xs text-on-surface-variant group-focus-within:text-primary">{label}</span>
      <Tag
        ref={ref}
        className={cx('block w-full bg-transparent text-base text-on-surface outline-none', Tag === 'textarea' && 'resize-none')}
        {...p}
      />
    </div>
    {hint && <p className="px-4 pt-1 text-xs text-on-surface-variant">{hint}</p>}
  </label>
))

// Toast pill: bottom center, floating above the FAB; surface-container-highest
// container, primary action, close affordance. Mount with a fresh `key` per
// message; it dismisses itself after `duration`.
export function Snackbar ({ message, action, duration = 4000, onClose }) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const t = setTimeout(() => close.current(), duration)
    return () => clearTimeout(t)
  }, [duration])

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 48 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
      className="fixed inset-x-0 bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+4.25rem)] z-50 mx-auto flex min-h-12 w-fit max-w-[min(28rem,calc(100vw-2rem))] items-center gap-2 rounded-full bg-surface-container-highest py-1 pr-2 pl-4 text-sm leading-5 text-on-surface shadow-md"
    >
      <span className="flex-1 line-clamp-2">{message}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="-ml-1 h-10 shrink-0 cursor-pointer rounded-full px-3 text-sm font-medium text-primary hover:bg-primary/8 active:bg-primary/12"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Close"
        onClick={() => close.current()}
        className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12 [&>svg]:size-6"
      >
        <CloseIcon />
      </button>
    </motion.div>
  )
}

export function Select ({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const away = e => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const current = options.find(o => o.value === value)
  return (
    <div ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={cx(
          'relative block w-full cursor-pointer rounded-t-xl border-b-2 bg-surface-container-highest px-4 py-2 text-left outline-none transition-colors',
          open ? 'border-primary' : 'border-on-surface-variant',
        )}
      >
        <span className={cx('block text-xs', open ? 'text-primary' : 'text-on-surface-variant')}>{label}</span>
        <span className="block min-h-6 truncate pr-8 text-base text-on-surface">{current?.label}</span>
        <ExpandMoreIcon className={cx('absolute top-1/2 right-3 size-6 -translate-y-1/2 text-on-surface-variant transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul role="listbox" className="mt-1 max-h-52 overflow-y-auto rounded-xl bg-surface-container-highest py-1">
          {options.map(o => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className="flex h-12 w-full cursor-pointer items-center justify-between px-4 text-base text-on-surface hover:bg-on-surface/8"
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <CheckIcon className="size-5 shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// + button that fans out into actions. actions: [{ label, icon, onSelect }] (top → bottom)
export function FabMenu ({ actions }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-30 bg-surface/80 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
      <div className="fixed right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3">
        <AnimatePresence>
          {open && actions.map((a, i) => (
            <motion.button
              key={a.label}
              type="button"
              initial={{ opacity: 0, y: 24, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 520, damping: 30, delay: (actions.length - 1 - i) * 0.05 } }}
              exit={{ opacity: 0, y: 12, scale: 0.9, transition: { duration: 0.12 } }}
              whileTap={{ scale: 0.96 }}
              style={{ transformOrigin: 'bottom right' }}
              onClick={() => { setOpen(false); a.onSelect() }}
              className="flex h-14 cursor-pointer items-center gap-3 rounded-2xl bg-primary-container pr-6 pl-4 text-base font-medium text-on-primary-container shadow-lg [&>svg]:size-6"
            >
              {a.icon}
              {a.label}
            </motion.button>
          ))}
        </AnimatePresence>
        <Fab aria-label={open ? 'Close menu' : 'Add'} aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <AddIcon className={cx('transition-transform duration-300 ease-out', open && 'rotate-135')} />
        </Fab>
      </div>
    </>
  )
}
