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

// Logical page ordering helper
const logicalOrder: Record<string, string[]> = {
  "getting-started": ["installation", "configuration", "quick-start"],
  architecture: [
    "overview",
    "data-flow",
    "communication",
    "bindings",
    "storage",
    "endpoints",
    "design-system",
  ],
  development: ["local-dev", "testing", "debugging"],
  deployment: [
    "installation-flow",
    "production",
    "zero-trust",
    "cicd",
    "monitoring",
  ],
  api: ["endpoints", "payloads", "responses"],
  operations: ["setup_and_operations", "tui", "cli_features"],
};

// Logical section sorting order
const sectionOrder: Record<string, number> = {
  "getting-started": 1,
  concepts: 2,
  guides: 3,
  tutorials: 4,
  reference: 5,
  architecture: 1,
  workers: 2,
  development: 3,
  deployment: 4,
  api: 5,
  operations: 6,
};

export function buildNavigation(
  entries: Array<{ id: string; title?: string }>
): NavSection[] {
  const tree: Record<string, NavItem[]> = {};

  for (const entry of entries) {
    const cleanId = entry.id.replace(/\.md$/, "");
    const parts = cleanId.split("/"); // e.g. ["enduser", "getting-started", "quick-start"]

    if (parts.length < 2) continue; // Skip top-level files (e.g. root files)

    const audiencePrefix = parts[0]; // "enduser" or "devops"
    let sectionKey = parts[1]; // "getting-started", "concepts", etc.
    const slugName = parts[parts.length - 1]; // "quick-start", etc.

    // Skip home/index pages in the dynamic item lists since home is hardcoded in header/sidebar
    if (slugName === "home" || slugName === "index") continue;

    // ── Custom Section Mapping for Root Directory Files ──
    if (parts.length === 2) {
      if (
        slugName === "setup_and_operations" ||
        slugName === "tui" ||
        slugName === "cli_features"
      ) {
        sectionKey = "operations";
      } else if (slugName === "installation-flow") {
        sectionKey = "deployment";
      } else {
        sectionKey = "operations";
      }
    }

    // Use audience-specific namespace for sectionKey so we don't mix them
    const sectionNamespace = `${audiencePrefix}:${sectionKey}`;

    if (!tree[sectionNamespace]) {
      tree[sectionNamespace] = [];
    }

    tree[sectionNamespace].push({
      title:
        entry.title ||
        slugName
          .split(/[_-]/) // Split on both underscores and hyphens
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      slug: cleanId,
      children: [],
      isIndex: false,
    });
  }

  const sections: NavSection[] = [];
  const sectionIcons: Record<string, string> = {
    // Enduser icons
    "getting-started": "rocket",
    guides: "book",
    concepts: "lightbulb",
    reference: "book-open",
    tutorials: "target",
    // DevOps icons
    architecture: "book",
    workers: "gear",
    development: "lightbulb",
    deployment: "rocket",
    api: "book-open",
    operations: "target",
  };

  for (const [namespace, items] of Object.entries(tree)) {
    const [audiencePrefix, sectionKey] = namespace.split(":");
    const audience: "user" | "devops" =
      audiencePrefix === "devops" ? "devops" : "user";

    const title = sectionKey
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    // Custom sorting based on our logicalOrder arrays
    const orderList = logicalOrder[sectionKey] || [];
    const sortedItems = items.sort((a, b) => {
      const aName = a.slug.split("/").pop() || "";
      const bName = b.slug.split("/").pop() || "";

      const aIndex = orderList.indexOf(aName);
      const bIndex = orderList.indexOf(bName);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      return a.title.localeCompare(b.title);
    });

    sections.push({
      title,
      icon: sectionIcons[sectionKey] || "book",
      audience,
      items: sortedItems,
    });
  }

  // Sort sections by their preset logical order
  return sections.sort((a, b) => {
    const aKey = a.title.toLowerCase().replace(" ", "-");
    const bKey = b.title.toLowerCase().replace(" ", "-");
    const aVal = sectionOrder[aKey] || 99;
    const bVal = sectionOrder[bKey] || 99;
    return aVal - bVal;
  });
}
