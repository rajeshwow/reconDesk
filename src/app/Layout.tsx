import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Icon } from '@/components/Icon'
import { PageSkeleton } from '@/components/Loader'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { isDark, useTheme } from './theme'
import styles from './Layout.module.css'

export function Layout() {
  const { pathname } = useLocation()
  const { theme, setTheme } = useTheme()
  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const dark = isDark(theme)

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className={styles.content}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Open menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <Icon name="menu" />
          </button>

          <button type="button" className={styles.searchButton} onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={16} />
            <span className={styles.searchText}>Search parties, invoices, bank lines…</span>
            <kbd className={styles.kbd}>Ctrl K</kbd>
          </button>

          <div className={styles.right}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={() => setTheme(dark ? 'light' : 'dark')}
            >
              <Icon name={dark ? 'sun' : 'moon'} />
            </button>
            <span className={styles.user}>
              <span className={styles.avatar} aria-hidden="true">
                AT
              </span>
              <span className={styles.userName}>Accounts team</span>
            </span>
          </div>
        </header>

        <main id="main" tabIndex={-1} className={styles.main}>
          {/* Keyed by module: a crash in one shouldn't follow you to the next. Not by the
              full path, or opening the drawer would remount the whole workbench. */}
          <ErrorBoundary key={pathname.split('/')[1]}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
