import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandShortcut,
} from "@/components/ui/command";

interface SearchEntry {
  slug: string;
  title: string;
  content: string;
  section: string;
}

/**
 * SearchDialog — Docs search via Cmd+K / Ctrl+K.
 *
 * Uses the optimized Command component wrappers for consistent styling
 * and proper Astro SSR compatibility.
 */
export default function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchEntry[]>([]);

  // Load search index once
  useEffect(() => {
    fetch("/hoox-setup/search-index.json")
      .then((r) => r.json())
      .then((data) => setIndex(data))
      .catch(() => console.warn("Search index not available"));
  }, []);

  // Filter results based on query — memoized for performance
  const results = useMemo(() => {
    if (!query.trim()) return index.slice(0, 10);
    const q = query.toLowerCase();
    return index
      .filter(
        (entry) =>
          entry.title.toLowerCase().includes(q) ||
          entry.content.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [query, index]);

  // Expose open function globally for header button
  useEffect(() => {
    (window as any).__openSearch = () => setOpen(true);
    return () => {
      delete (window as any).__openSearch;
    };
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runSearch = useCallback((value: string) => {
    setOpen(false);
    window.location.href = `/hoox-setup/${value}/`;
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search Docs"
      description="Search the Hoox documentation"
    >
      <Command shouldFilter={false} className="bg-transparent">
        <CommandInput
          placeholder="Search docs..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {results.map((entry) => (
              <CommandItem
                key={entry.slug}
                value={entry.slug}
                onSelect={runSearch}
              >
                <span className="font-medium">{entry.title}</span>
                <CommandShortcut className="ml-auto">
                  {entry.section}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}


