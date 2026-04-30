"use client"

import { useState, useEffect } from "react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  LayoutDashboard,
  TrendingUp,
  Wrench,
  Settings,
  GitBranch,
  ScrollText,
  Home,
  Search,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

interface CommandItem {
  icon: typeof LayoutDashboard
  label: string
  shortcut?: string
  action: () => void
  group: string
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const commands: CommandItem[] = [
    {
      icon: Home,
      label: "Go to Home",
      shortcut: "⌘H",
      action: () => router.push("/"),
      group: "Navigation",
    },
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      shortcut: "⌘D",
      action: () => router.push("/dashboard"),
      group: "Navigation",
    },
    {
      icon: TrendingUp,
      label: "Positions",
      shortcut: "⌘P",
      action: () => router.push("/dashboard/positions"),
      group: "Navigation",
    },
    {
      icon: Wrench,
      label: "Setup",
      shortcut: "⌘S",
      action: () => router.push("/dashboard/setup"),
      group: "Navigation",
    },
    {
      icon: Settings,
      label: "Settings",
      shortcut: "⌘,",
      action: () => router.push("/dashboard/settings"),
      group: "Navigation",
    },
    {
      icon: GitBranch,
      label: "Signal Flow",
      shortcut: "",
      action: () => router.push("/dashboard/signal-flow"),
      group: "Navigation",
    },
    {
      icon: ScrollText,
      label: "System Logs",
      shortcut: "",
      action: () => router.push("/dashboard/logs"),
      group: "Navigation",
    },
  ]

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <CommandDialog open={open} onOpenChange={setOpen} title="Command Palette" description="Search for pages and actions...">
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          <CommandGroup heading="Navigation">
            {commands
              .filter((cmd) => cmd.group === "Navigation")
              .map((cmd) => (
                <CommandItem
                  key={cmd.label}
                  onSelect={() => {
                    cmd.action()
                    setOpen(false)
                  }}
                  className="cursor-pointer"
                >
                  <cmd.icon className="mr-2 h-4 w-4" />
                  <span>{cmd.label}</span>
                  {cmd.shortcut && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {cmd.shortcut}
                    </span>
                  )}
                </CommandItem>
              ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                window.location.reload()
                setOpen(false)
              }}
              className="cursor-pointer"
            >
              <motion.div
                initial={{ rotate: 0 }}
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                <Search className="mr-2 h-4 w-4" />
              </motion.div>
              <span>Refresh Page</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Cmd+K Hint */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 0.5 }}
        className="fixed bottom-4 right-4 z-40"
      >
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Search className="h-3 w-3" />
          <span>Search...</span>
          <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>
      </motion.div>
    </>
  )
}
