import { SearchInput } from "@ledgerhq/lumen-ui-react";
import { useEffect, useMemo, useState } from "react";
import { Category } from "../types";
import type { Tool } from "../types";
import { useAccordion } from "../hooks";
import { CATEGORY_ICONS } from "../categoryConfig";
import { CategoryRow } from "./CategoryRow";

interface SidebarProps {
  categories: Array<{ category: Category; tools: Tool[] }>;
  activeToolId: string | undefined;
  onSelectTool: (id: string) => void;
}

export function Sidebar({ categories, activeToolId, onSelectTool }: SidebarProps) {
  const { isExpanded, toggle, expand } = useAccordion<Category>({ mode: "single" });
  const [query, setQuery] = useState("");

  // Expand a category if the tool id changes somewhere else
  useEffect(() => {
    if (!activeToolId) return;
    const match = categories.find(({ tools }) => tools.some(t => t.id === activeToolId));
    if (match) expand(match.category);
  }, [activeToolId]);

  const q = query.trim().toLowerCase();

  const filteredCategories = useMemo(
    () =>
      categories
        .map(({ category, tools }) => ({
          category,
          tools: q
            ? tools.filter(
                t =>
                  t.label.toLowerCase().includes(q) ||
                  t.category.toLowerCase().includes(q) ||
                  (t.owner ?? "").toLowerCase().includes(q),
              )
            : tools,
        }))
        .filter(({ tools }) => tools.length > 0),
    [categories, q],
  );

  return (
    <nav
      data-testid="devtools-nav"
      className="w-[240px] shrink-0 bg-surface border-r border-muted flex flex-col"
    >
      <div className="p-12">
        <SearchInput
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search tools"
          data-testid="devtools-search"
        />
      </div>

      <ul className="flex flex-col flex-1 list-none px-8 pb-12 gap-4 overflow-y-auto">
        {filteredCategories.length === 0 && (
          <li className="px-12 py-8 body-3 text-muted">No tools match &ldquo;{query}&rdquo;.</li>
        )}
        {filteredCategories.map(({ category, tools }) => (
          <CategoryRow
            key={category}
            category={category}
            tools={tools}
            icon={CATEGORY_ICONS[category]}
            isExpanded={isExpanded(category)}
            onToggle={() => toggle(category)}
            activeToolId={activeToolId}
            onSelectTool={onSelectTool}
          />
        ))}
      </ul>
    </nav>
  );
}
