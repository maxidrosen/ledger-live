import React from "react";
import { Pressable, View } from "react-native";
import { ABTestingVariants } from "@ledgerhq/types-live";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { act, render, screen, waitFor, withFlagOverrides } from "@tests/test-renderer";
import storage from "LLM/storage";
import SwapNavigator from "~/components/RootNavigator/SwapNavigator";
import type { BaseNavigatorStackParamList } from "~/components/RootNavigator/types/BaseNavigator";
import { NavigatorName, ScreenName } from "~/const";
import GlobalDrawers from "~/GlobalDrawers";
import { track } from "~/analytics";
import { MockedAccounts } from "LLM/features/Accounts/__integrations__/mockedAccounts";

const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
  EPHEMERAL: 3,
} as const;

type AuthorizationStatusType = (typeof AuthorizationStatus)[keyof typeof AuthorizationStatus];

const mockRequestPermission = jest.fn<Promise<AuthorizationStatusType>, []>(() =>
  Promise.resolve(AuthorizationStatus.NOT_DETERMINED),
);
const mockHasPermission = jest.fn<Promise<AuthorizationStatusType>, []>(() =>
  Promise.resolve(AuthorizationStatus.NOT_DETERMINED),
);

jest.mock("~/analytics", () => {
  const track = jest.fn();

  return {
    track,
    useTrack: () => track,
    TrackScreen: () => null,
  };
});

jest.mock("@react-native-firebase/messaging", () => {
  const AuthorizationStatus = {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
    EPHEMERAL: 3,
  } as const;

  return {
    AuthorizationStatus,
    getMessaging: jest.fn(() => ({
      requestPermission: mockRequestPermission,
      hasPermission: mockHasPermission,
    })),
  };
});

const featureFlagsForSwapPrompt = {
  brazePushNotifications: {
    enabled: true,
    params: {
      action_events: {
        complete_onboarding: {
          enabled: true,
          timer: 0,
        },
        add_favorite_coin: {
          enabled: true,
          timer: 0,
        },
        send: {
          enabled: true,
          timer: 0,
        },
        receive: {
          enabled: true,
          timer: 0,
        },
        buy: {
          enabled: true,
          timer: 0,
        },
        swap: {
          enabled: true,
          timer: 0,
        },
        stake: {
          enabled: true,
          timer: 0,
        },
      },
      reprompt_schedule: [{ months: 0, days: 7, hours: 0, minutes: 0, seconds: 0 }],
      inactivity_enabled: false,
      inactivity_reprompt: { months: 6, days: 0, hours: 0, minutes: 0, seconds: 0 },
    },
  },
  lwmNewWordingOptInNotificationsDrawer: {
    enabled: true,
    params: {
      variant: ABTestingVariants.variantB,
    },
  },
};

describe("NotificationsPrompt swap flow", () => {
  beforeEach(async () => {
    jest.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
    mockRequestPermission.mockResolvedValue(AuthorizationStatus.NOT_DETERMINED);
    mockHasPermission.mockResolvedValue(AuthorizationStatus.NOT_DETERMINED);
    await storage.deleteAll();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const HOME_SCREEN = "Home";

  type SwapFlowStackParamList = {
    [HOME_SCREEN]: undefined;
    [NavigatorName.Swap]: BaseNavigatorStackParamList[NavigatorName.Swap];
  };

  const Stack = createNativeStackNavigator<SwapFlowStackParamList>();

  function HomeScreen() {
    return <View />;
  }

  const swapOperation = {
    swapId: "swap-123",
    provider: "changelly",
    toCurrency: { id: "ethereum", name: "Ethereum" },
    fromCurrency: { id: "bitcoin", name: "Bitcoin" },
  };

  const swapFlowNavigationState = {
    index: 1,
    routes: [
      {
        name: HOME_SCREEN,
      },
      {
        name: NavigatorName.Swap,
        state: {
          index: 0,
          routes: [
            {
              name: ScreenName.SwapPendingOperation,
              params: {
                swapOperation,
              },
            },
          ],
        },
      },
    ],
  };

  function SwapFlowTestApp() {
    return (
      <GlobalDrawers>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name={HOME_SCREEN} component={HomeScreen} />
          <Stack.Screen
            name={NavigatorName.Swap}
            options={({ navigation }) => ({
              headerShown: true,
              headerLeft: () => (
                <Pressable testID="leave-swap-button" onPress={() => navigation.goBack()}>
                  <View />
                </Pressable>
              ),
            })}
          >
            {props => <SwapNavigator {...props} />}
          </Stack.Screen>
        </Stack.Navigator>
      </GlobalDrawers>
    );
  }

  it("should prompt the notifications drawer when leaving the swap confirmation screen", async () => {
    const { user } = render(<SwapFlowTestApp />, {
      navigationInitialState: swapFlowNavigationState,
      overrideInitialState: withFlagOverrides(featureFlagsForSwapPrompt, state => ({
        ...state,
        accounts: MockedAccounts,
        notifications: {
          ...state.notifications,
          permissionStatus: AuthorizationStatus.NOT_DETERMINED,
        },
        settings: {
          ...state.settings,
          readOnlyModeEnabled: false,
          notifications: {
            ...state.settings.notifications,
            areNotificationsAllowed: true,
          },
        },
      })),
    });

    await waitFor(() => expect(screen.getByTestId("swap-success-title")).toBeVisible());
    expect(screen.queryByText(/allow notifications/i)).toBeNull();
    expect(track).not.toHaveBeenCalledWith(
      "attempt_to_trigger_push_notification_drawer_after_action",
    );

    await user.press(screen.getByTestId("leave-swap-button"));
    act(() => jest.runOnlyPendingTimers());

    await waitFor(() => {
      expect(screen.getByText(/allow notifications/i)).toBeVisible();
    });
    expect(track).toHaveBeenCalledWith("attempt_to_trigger_push_notification_drawer_after_action", {
      action: "swap",
      shouldPrompt: true,
      variant: ABTestingVariants.variantB,
      repromptDelay: null,
      dismissedCount: 0,
      skipReason: undefined,
    });
    expect(screen.getByText(/maybe later/i)).toBeOnTheScreen();
  });
});
