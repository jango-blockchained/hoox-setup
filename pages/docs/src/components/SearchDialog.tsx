import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";

interface SearchEntry {
  slug: string;
  title: string;
  content: string;
  section: string;
}

export default function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [index, setIndex] = useState<SearchEntry[]>([]);

  useEffect(() => {
    fetch("/hoox-setup/search-index.json")
      .then((r) => r.json())
      .then((data) => setIndex(data))
      .catch(() => console.warn("Search index not available"));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults(index.slice(0, 10));
      return;
    }
    const q = query.toLowerCase();
    const filtered = index.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.content.toLowerCase().includes(q)
    );
    setResults(filtered.slice(0, 20));
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
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runSearch = useCallback((value: string) => {
    setOpen(false);
    window.location.href = `/hoox-setup/${value}/`;
  }, []);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50" role="dialog">
        <div
          className="fixed inset-0 bg-black/50"
          onClick={() => setOpen(false)}
        />
        <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
          <Command className="rounded-lg border border-border bg-popover shadow-2xl overflow-hidden">
            <div className="flex items-center border-b border-border px-3">
              <svg
                className="mr-2 size-4 shrink-0 text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <Command.Input
                placeholder="Search docs..."
                value={query}
                onValueChange={setQuery}
                className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            <Command.List className="max-h-72 overflow-y-auto p-2">
              {query && results.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No results found.
                </div>
              )}
              <Command.Group heading="Pages">
                {results.map((entry) => (
                  <Command.Item
                    key={entry.slug}
                    value={entry.slug}
                    onSelect={runSearch}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <span className="font-medium">{entry.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {entry.section}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </div>
      </div>
    </>
  );
}
