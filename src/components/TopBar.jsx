import { AnimatePresence, motion } from 'motion/react'
import { IconButton } from '../ui.jsx'
import { CancelIcon, SearchIcon, SettingsIcon } from '../icons.jsx'

// title row scrolls away while search and folder chips stay pinned
export default function TopBar ({ searchRef, query, resultCount, onQuery, onSettings, children }) {
  return (
    <>
      <div className="flex h-16 items-center justify-between pr-3 pl-5">
        <h1 className="text-[22px] leading-7 font-medium">Note</h1>
        <IconButton aria-label="Settings" onClick={onSettings}>
          <SettingsIcon />
        </IconButton>
      </div>

      <div className="sticky top-0 z-20 bg-surface pt-1 pb-2">
        <label className="group mx-4 flex h-14 items-center gap-2 rounded-full bg-surface-container-high pr-2 pl-5 text-on-surface-variant transition-[background-color,box-shadow] duration-200 focus-within:bg-surface-container-highest focus-within:shadow-md">
          <SearchIcon className="size-6 shrink-0 transition-colors group-focus-within:text-primary" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={e => onQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') query ? onQuery('') : e.currentTarget.blur()
            }}
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search snippets"
            aria-label="Search snippets"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-on-surface caret-primary outline-none placeholder:text-on-surface-variant [&::-webkit-search-cancel-button]:hidden"
          />
          <AnimatePresence initial={false}>
            {query ? (
              <motion.div
                key="tools"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                className="flex items-center gap-1"
              >
                <span aria-live="polite" className="rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">
                  {resultCount}
                </span>
                <IconButton aria-label="Clear search" onClick={() => { onQuery(''); searchRef.current?.focus() }}>
                  <CancelIcon />
                </IconButton>
              </motion.div>
            ) : (
              <kbd key="hint" className="mr-3 hidden rounded-md border border-outline-variant px-1.5 text-xs leading-5 md:block">/</kbd>
            )}
          </AnimatePresence>
        </label>
        {children}
      </div>
    </>
  )
}

