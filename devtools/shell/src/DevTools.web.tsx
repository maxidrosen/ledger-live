import { StyleProvider, Flex, Text, Button } from "@ledgerhq/react-ui";
import { TOOLS } from "./tools.config";
import { useDevToolsNavigation } from "./hooks";

export const DevTools = () => {
  const { activeTool, setActiveTool, expandedCategories, toggleCategory, categoriesWithTools } =
    useDevToolsNavigation(TOOLS);

  return (
    <StyleProvider selectedPalette="dark">
      <Flex data-testid="devtools" height="100%" minHeight={400}>
        <Flex
          as="nav"
          data-testid="devtools-nav"
          flexDirection="column"
          width={220}
          borderRight="1px solid"
          borderColor="neutral.c30"
        >
          <Text variant="small" fontWeight="600" uppercase p={4} borderBottom="1px solid" borderColor="neutral.c30">
            DevTools
          </Text>
          <Flex as="ul" flexDirection="column" flex={1} py={2} style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {categoriesWithTools.map(category => {
              const toolsInCategory = TOOLS.filter(t => t.category === category);
              const isExpanded = expandedCategories.has(category);
              return (
                <Flex as="li" key={category} flexDirection="column">
                  <Button
                    variant="shade"
                    aria-label={category}
                    aria-expanded={isExpanded}
                    onClick={() => toggleCategory(category)}
                  >
                    <span aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>
                    {category}
                  </Button>
                  {isExpanded && (
                    <Flex as="ul" flexDirection="column" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {toolsInCategory.map(tool => (
                        <Flex as="li" key={tool.label}>
                          <Button
                            variant={activeTool === tool ? "main" : "neutral"}
                            aria-current={activeTool === tool ? "page" : undefined}
                            onClick={() => setActiveTool(tool)}
                          >
                            {tool.label}
                          </Button>
                        </Flex>
                      ))}
                    </Flex>
                  )}
                </Flex>
              );
            })}
          </Flex>
        </Flex>
        <Flex as="main" data-testid="devtools-content" flex={1} p={6} overflow="auto">
          {activeTool === null ? (
            <Text data-testid="devtools-empty">Select a tool from the sidebar.</Text>
          ) : (
            <Text>{activeTool.label}</Text>
          )}
        </Flex>
      </Flex>
    </StyleProvider>
  );
};
