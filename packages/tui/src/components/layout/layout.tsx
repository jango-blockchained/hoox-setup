/** @jsxImportSource @opentui/react */

import type { ReactNode } from 'react'
import { delegate } from '@opentui/core'
import { Sidebar } from './sidebar'
import { TabBar } from './tabbar'
import { StatusBar } from './statusbar'

/**
 * Layout — root shell that persists across all views.
 *
 * Composition:
 * ┌──────┬──────────────────────────────────────────────┐
 * │  S   │  TabBar (10 tabs, orange underline on active)│
 * │  I   │──────────────────────────────────────────────│
 * │  D   │                                              │
 * │  E   │           Content (children)                 │
 * │  B   │           flexGrow: 1                        │
 * │  A   │                                              │
 * │  R   │                                              │
 * │      ├──────────────────────────────────────────────│
 * │      │  StatusBar (connection, workers, P&L, clock) │
 * └──────┴──────────────────────────────────────────────┘
 *
 * Focus routing: delegate() wraps the content pane so that
 * keyboard focus lands in the active view's focusable elements.
 */

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  // Wrap the content area in delegate so keyboard focus is forwarded
  // into the active view. The sidebar and tabbar receive focus via
  // global keyboard dispatch (Ctrl+B for sidebar toggle, Ctrl+1–0 for tabs).
  const contentPane = delegate(
    { focus: 'content-area' },
    <box id="content-area" flexGrow={1}>
      {children}
    </box>,
  )

  return (
    <box flexDirection="row" width="100%" height="100%">
      {/* Left sidebar: 4 cols, persistent navigation */}
      <Sidebar />

      {/* Main column: tabs + content + status bar */}
      <box flexDirection="column" flexGrow={1}>
        <TabBar />
        {contentPane}
        <StatusBar />
      </box>
    </box>
  )
}
