/** @jsxImportSource @opentui/react */

import { Colors } from '@jango-blockchained/hoox-shared'
import { useUIStore } from '@jango-blockchained/hoox-shared/stores/ui-store'
import { VIEWS, type ViewId } from '../../types'

/**
 * TabBar — horizontal row of 10 tab items.
 *
 * Each tab shows a shortcut hint (^1–^0) and the view label.
 * The active tab receives an orange underline + bold text;
 * inactive tabs are dimmed. Clicking a tab switches the active view
 * via the UI store.
 */
export function TabBar() {
  const activeView = useUIStore((s) => s.activeView)
  const setActiveView = useUIStore((s) => s.setActiveView)

  function handleSelect(view: ViewId) {
    setActiveView(view)
  }

  return (
    <box
      flexDirection="row"
      gap={1}
      paddingLeft={2}
      paddingRight={2}
      height={1}
      justifyContent="flex-start"
    >
      {VIEWS.map((v) => {
        const isActive = v.id === activeView
        return (
          <text
            key={v.id}
            fg={isActive ? Colors.accent.toHex() : Colors.muted.toHex()}
            bold={isActive}
            dim={!isActive}
            underline={isActive}
            onMouseUp={() => handleSelect(v.id)}
          >
            {v.shortcut}
            {v.label.substring(0, 8)}
          </text>
        )
      })}
    </box>
  )
}
