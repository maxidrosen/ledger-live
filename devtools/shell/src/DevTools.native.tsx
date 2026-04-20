import { StyleProvider, Flex, Text, Button } from "@ledgerhq/native-ui";
import { ScrollView } from "react-native";
import { Category } from "./types";
import { TOOLS } from "./tools.config";
import { useDevToolsNavigation } from "./hooks";

export const DevTools = () => {
  const { activeTool, setActiveTool, expandedCategories, toggleCategory } =
    useDevToolsNavigation(TOOLS);

  return (
    <StyleProvider selectedPalette="dark">
      <Flex testID="devtools" flex={1} flexDirection="row" backgroundColor="background.main">
        <Flex
          testID="devtools-nav"
          flexDirection="column"
          width={220}
          flexShrink={0}
          backgroundColor="background.card"
          borderRightWidth={1}
          borderRightColor="neutral.c30"
        >
          <Text
            variant="small"
            fontWeight="medium"
            uppercase
            px={3}
            py={2}
            borderBottomWidth={1}
            borderBottomColor="neutral.c30"
          >
            DevTools
          </Text>
          <ScrollView>
            <Flex flexDirection="column" py={1} px={2}>
              {Object.values(Category).map(category => {
                const toolsInCategory = TOOLS.filter(t => t.category === category);
                const isExpanded = expandedCategories.has(category);
                return (
                  <Flex key={category} flexDirection="column">
                    <Button
                      type="shade"
                      size="small"
                      accessibilityLabel={category}
                      onPress={() => toggleCategory(category)}
                    >
                      {(isExpanded ? "▾ " : "▸ ") + category}
                    </Button>
                    {isExpanded && toolsInCategory.length > 0 && (
                      <Flex flexDirection="column" px={2}>
                        {toolsInCategory.map(tool => (
                          <Button
                            key={tool.label}
                            type={activeTool === tool ? "main" : "shade"}
                            size="small"
                            accessibilityLabel={tool.label}
                            onPress={() => setActiveTool(tool)}
                          >
                            {tool.label}
                          </Button>
                        ))}
                      </Flex>
                    )}
                    {isExpanded && toolsInCategory.length === 0 && (
                      <Text variant="tiny" color="neutral.c50" px={3} py={1}>
                        No tools available
                      </Text>
                    )}
                  </Flex>
                );
              })}
            </Flex>
          </ScrollView>
        </Flex>
        <Flex testID="devtools-content" flexDirection="column" flex={1}>
          {activeTool !== null && (
            <Text variant="h5" px={6} py={4} borderBottomWidth={1} borderBottomColor="neutral.c30">
              {activeTool.label}
            </Text>
          )}
          <ScrollView>
            <Flex p={6}>
              {activeTool === null ? (
                <Text testID="devtools-empty" color="neutral.c50">
                  Select a tool from the sidebar.
                </Text>
              ) : (
                <Text>{activeTool.label}</Text>
              )}
            </Flex>
          </ScrollView>
        </Flex>
      </Flex>
    </StyleProvider>
  );
};
