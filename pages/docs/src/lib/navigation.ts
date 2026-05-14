export interface NavItem {
  title: string;
  slug: string;
  children: NavItem[];
  isIndex?: boolean;
}

export interface NavSection {
  title: string;
  icon: string;
  items: NavItem[];
  audience: "user" | "devops";
}

export function filterNavigation(
  sections: NavSection[],
  audience: "user" | "devops"
): NavSection[] {
  return sections.filter((s) => s.audience === audience);
}

export function buildNavigation(
  entries: Array<{ id: string; title?: string }>
): NavSection[] {
  const tree: Record<string, NavItem[]> = {};

  for (const entry of entries) {
    const parts = entry.id.replace(/\.md$/, "").split("/");
    const fileName = parts.pop()!;
    const sectionKey = parts[0] || "root";

    if (!tree[sectionKey]) {
      tree[sectionKey] = [];
    }

    tree[sectionKey].push({
      title: entry.title || fileName,
      slug: entry.id.replace(/\.md$/, ""),
      children: [],
      isIndex: fileName === "home" || fileName === "index",
    });
  }

  const sections: NavSection[] = [];
  const sectionIcons: Record<string, string> = {
    root: "📄",
    "getting-started": "🚀",
    guides: "📘",
    concepts: "🧠",
    reference: "📖",
    tutorials: "🎯",
    devops: "⚙️",
  };

  const audienceMap: Record<string, "user" | "devops"> = {
    "getting-started": "user",
    guides: "user",
    concepts: "user",
    reference: "user",
    tutorials: "user",
    devops: "devops",
  };

  for (const [key, items] of Object.entries(tree)) {
    if (key === "root") continue;
    const title = key
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    sections.push({
      title,
      icon: sectionIcons[key] || "📋",
      audience: audienceMap[key] || "user",
      items: items.sort((a, b) => a.title.localeCompare(b.title)),
    });
  }

  return sections;
}
