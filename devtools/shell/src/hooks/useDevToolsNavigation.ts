import { useState } from "react";
import { Category } from "../types";
import type { Tool } from "../types";

export const useDevToolsNavigation = (tools: Tool[]) => {
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(new Set());

  const toggleCategory = (category: Category) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const categoriesWithTools = Object.values(Category).filter(cat =>
    tools.some(t => t.category === cat),
  );

  return {
    activeTool,
    setActiveTool,
    expandedCategories,
    toggleCategory,
    categoriesWithTools,
  };
};
