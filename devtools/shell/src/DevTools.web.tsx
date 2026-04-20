import type { CSSProperties } from "react";
import { TOOLS } from "./tools.config";
import { useDevToolsNavigation } from "./hooks";

const styles = {
  container: {
    display: "flex",
    height: "100%",
    minHeight: 400,
    fontFamily:
      "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
    fontSize: 13,
    backgroundColor: "#1e1e1e",
    color: "#cccccc",
    overflow: "hidden",
  } satisfies CSSProperties,
  sidebar: {
    width: 220,
    flexShrink: 0,
    borderRight: "1px solid #3c3c3c",
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,
  brand: {
    padding: "16px 16px 12px",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#858585",
    borderBottom: "1px solid #3c3c3c",
  } satisfies CSSProperties,
  categoryList: {
    listStyle: "none",
    margin: 0,
    padding: "8px 0",
    flex: 1,
  } satisfies CSSProperties,
  categoryButton: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    padding: "6px 12px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#858585",
    textAlign: "left",
  } satisfies CSSProperties,
  toolList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  } satisfies CSSProperties,
  toolButton: {
    display: "block",
    width: "100%",
    padding: "5px 12px 5px 24px",
    background: "none",
    border: "none",
    borderLeft: "2px solid transparent",
    cursor: "pointer",
    fontSize: 13,
    color: "#cccccc",
    textAlign: "left",
    lineHeight: "20px",
  } satisfies CSSProperties,
  toolButtonActive: {
    backgroundColor: "#2a2d2e",
    color: "#ffffff",
    borderLeftColor: "#007acc",
  } satisfies CSSProperties,
  content: {
    flex: 1,
    padding: 24,
    overflow: "auto",
  } satisfies CSSProperties,
} as const;

export const DevTools = () => {
  const {
    activeTool,
    setActiveTool,
    expandedCategories,
    toggleCategory,
    categoriesWithTools,
  } = useDevToolsNavigation(TOOLS);

  return (
    <div data-testid="devtools" style={styles.container}>
      <nav data-testid="devtools-nav" style={styles.sidebar}>
        <div style={styles.brand}>DevTools</div>
        <ul style={styles.categoryList}>
          {categoriesWithTools.map(category => {
            const toolsInCategory = TOOLS.filter(t => t.category === category);
            const isExpanded = expandedCategories.has(category);
            return (
              <li key={category}>
                <button
                  aria-label={category}
                  aria-expanded={isExpanded}
                  style={styles.categoryButton}
                  onClick={() => toggleCategory(category)}
                >
                  <span aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>
                  {category}
                </button>
                {isExpanded && (
                  <ul style={styles.toolList}>
                    {toolsInCategory.map(tool => (
                      <li key={tool.label}>
                        <button
                          aria-current={
                            activeTool === tool ? "page" : undefined
                          }
                          style={{
                            ...styles.toolButton,
                            ...(activeTool === tool
                              ? styles.toolButtonActive
                              : {}),
                          }}
                          onClick={() => setActiveTool(tool)}
                        >
                          {tool.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <main data-testid="devtools-content" style={styles.content}>
        {activeTool === null ? (
          <div data-testid="devtools-empty">Select a tool from the sidebar.</div>
        ) : (
          <div>{activeTool.label}</div>
        )}
      </main>
    </div>
  );
};
