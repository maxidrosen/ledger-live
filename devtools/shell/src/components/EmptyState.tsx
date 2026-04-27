import { useEffect, useState } from "react";
import { ChevronRight, Star, Clock } from "@ledgerhq/lumen-ui-react/symbols";
import { Category } from "../types";
import type { Tool } from "../types";
import { CATEGORY_ICONS } from "../categoryConfig";
import { STORAGE_KEY, deserialize } from "../hooks/devToolsStorageUtils";
import { TOOLS } from "../tools.config";

interface EmptyStateProps {
  categories: Array<{ category: Category; tools: Tool[] }>;
  onSelect: (id: string) => void;
  "data-testid"?: string;
}

function SectionHeader({ icon: Icon, label }: { icon: typeof ChevronRight; label: string }) {
  return (
    <div className="flex items-center gap-8 mb-12">
      <Icon size={16} className="text-muted" />
      <span className="body-3 font-semibold uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}

function IconSquare({ category }: { category: Category }) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <div className="w-36 h-36 bg-canvas rounded-lg border border-muted shrink-0 flex items-center justify-center">
      <Icon size={20} />
    </div>
  );
}

function CategoryCard({
  category,
  tools,
  onSelect,
}: {
  category: Category;
  tools: Tool[];
  onSelect: (id: string) => void;
}) {
  return (
    <button
      className="flex items-center gap-12 p-12 rounded-xl bg-surface-hover hover:ring-1 hover:ring-muted text-left w-full border-none cursor-pointer"
      onClick={() => tools[0] && onSelect(tools[0].id)}
    >
      <IconSquare category={category} />
      <div className="flex-1 min-w-0">
        <div className="body-2 font-semibold truncate">{category}</div>
        <div className="body-3 text-muted">
          {tools.length} tool{tools.length !== 1 ? "s" : ""}
        </div>
      </div>
      <ChevronRight size={16} className="text-muted shrink-0" />
    </button>
  );
}

function ToolCard({ tool, onSelect }: { tool: Tool; onSelect: (id: string) => void }) {
  return (
    <button
      className="flex items-center gap-12 p-12 rounded-xl bg-surface-hover hover:ring-1 hover:ring-muted text-left w-full border-none cursor-pointer"
      onClick={() => onSelect(tool.id)}
    >
      <IconSquare category={tool.category} />
      <div className="flex-1 min-w-0">
        <div className="body-2 font-semibold truncate">{tool.label}</div>
        <div className="body-3 text-muted truncate">{tool.category}</div>
      </div>
      <ChevronRight size={16} className="text-muted shrink-0" />
    </button>
  );
}

export function EmptyState({ categories, onSelect, "data-testid": testId }: EmptyStateProps) {
  const [recentTools, setRecentTools] = useState<Tool[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { recentToolIds } = deserialize(raw);
        if (recentToolIds) {
          setRecentTools(recentToolIds.flatMap(id => TOOLS.filter(t => t.id === id)));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div data-testid={testId} className="flex-1 p-32 overflow-y-auto">
      <p className="body-1 text-muted uppercase tracking-wider">DevTools</p>
      <h1 className="heading-1 font-semibold">What do you need to inspect?</h1>
      <p className="body-1 text-muted mb-24">Pick a tool from the sidebar.</p>

      {recentTools.length > 0 && (
        <div className="mb-24">
          <SectionHeader icon={Clock} label="Recent" />
          <div className="grid grid-cols-2 gap-8">
            {recentTools.map(tool => (
              <ToolCard key={tool.id} tool={tool} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      <SectionHeader icon={Star} label="All Tools" />
      <div className="grid grid-cols-2 gap-8">
        {categories.map(({ category, tools }) => (
          <CategoryCard key={category} category={category} tools={tools} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
