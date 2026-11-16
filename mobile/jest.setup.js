// Mock react-native-gesture-handler
try {
  require('react-native-gesture-handler/jestSetup');
} catch (e) {
  // Graceful fallback if not found in mock environment
}

// Mock react-native-reanimated
try {
  const reanimated = require('react-native-reanimated');
  if (typeof reanimated.setUpTests === 'function') {
    reanimated.setUpTests();
  }
} catch (e) {
  // Fallback
}

// Mock SecureStore
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (key) => store.get(key) || null),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, String(value));
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
  };
});

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[mock]' })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5 },
}));

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props) => <View {...props} />,
    Marker: (props) => <View {...props} />,
    Callout: (props) => <View {...props} />,
    PROVIDER_GOOGLE: 'google',
  };
});

// Mock @gorhom/bottom-sheet
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((props, ref) => <View {...props} />),
    BottomSheetView: (props) => <View {...props} />,
    BottomSheetBackdrop: (props) => <View {...props} />,
  };
});
