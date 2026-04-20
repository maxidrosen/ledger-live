import { StyleProvider, Flex, Text, Button } from "@ledgerhq/react-ui";
import { Category } from "./types";
import { TOOLS } from "./tools.config";
import { useDevToolsNavigation } from "./hooks";

export const DevTools = () => {
  const { activeTool, setActiveTool, expandedCategories, toggleCategory } =
    useDevToolsNavigation(TOOLS);

  return (
    <StyleProvider selectedPalette="dark">
      <Flex data-testid="devtools" width="100%" height="100%" backgroundColor="background.main">
        <Flex
          as="nav"
          data-testid="devtools-nav"
          flexDirection="column"
          width={220}
          flexShrink={0}
          backgroundColor="background.card"
          borderRight="1px solid"
          borderColor="neutral.c30"
        >
          <Text
            variant="small"
            fontWeight="600"
            uppercase
            px={3}
            py={2}
            borderBottom="1px solid"
            borderColor="neutral.c30"
          >
            DevTools
          </Text>
          <Flex
            as="ul"
            flexDirection="column"
            flex={1}
            py={1}
            style={{ listStyle: "none", margin: 0, padding: "0 8px", gap: "1%" }}
          >
            {Object.values(Category).map(category => {
              const toolsInCategory = TOOLS.filter(t => t.category === category);
              const isExpanded = expandedCategories.has(category);
              return (
                <Flex as="li" key={category} flexDirection="column">
                  <Button
                    variant="shade"
                    size="xs"
                    width="100%"
                    aria-label={category}
                    aria-expanded={isExpanded}
                    onClick={() => toggleCategory(category)}
                  >
                    <span aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>
                    {category}
                  </Button>
                  {isExpanded && toolsInCategory.length > 0 && (
                    <Flex
                      as="ul"
                      flexDirection="column"
                      style={{ listStyle: "none", margin: 0, padding: "0 8px" }}
                    >
                      {toolsInCategory.map(tool => (
                        <Flex as="li" key={tool.label}>
                          <Button
                            variant={activeTool === tool ? "main" : "shade"}
                            size="xs"
                            width="100%"
                            aria-current={activeTool === tool ? "page" : undefined}
                            onClick={() => setActiveTool(tool)}
                            backgroundColor={activeTool !== tool ? "background.main" : undefined}
                          >
                            {tool.label}
                          </Button>
                        </Flex>
                      ))}
                    </Flex>
                  )}
                  {isExpanded && toolsInCategory.length === 0 && (
                    <Text variant="extraSmall" color="neutral.c50" px={3} py={1}>
                      No tools available
                    </Text>
                  )}
                </Flex>
              );
            })}
          </Flex>
        </Flex>
        <Flex
          as="main"
          data-testid="devtools-content"
          flexDirection="column"
          flex={1}
          overflow="auto"
        >
          {activeTool !== null && (
            <Text variant="h5" px={6} py={4} borderBottom="1px solid" borderColor="neutral.c30">
              {activeTool.label}
            </Text>
          )}
          <Flex flex={1} p={6}>
            {activeTool === null ? (
              <Text data-testid="devtools-empty" color="neutral.c50">
                Select a tool from the sidebar.
              </Text>
            ) : (
              <Text>{activeTool.label}</Text>
            )}
          </Flex>
        </Flex>
      </Flex>
    </StyleProvider>
  );
};
