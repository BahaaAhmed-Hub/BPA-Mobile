// Use require() instead of import so we can catch errors during module loading.
// Static import statements are hoisted and evaluated before any code runs,
// meaning a crash in the import chain would bypass ErrorUtils handlers.
try {
  const { registerRootComponent } = require('expo');
  const App = require('./App').default;
  registerRootComponent(App);
} catch (e: unknown) {
  // If the app crashes during startup (import-time error), show an alert.
  const { Alert } = require('react-native');
  const msg = e instanceof Error ? `${e.message}\n\n${(e.stack ?? '').slice(0, 600)}` : String(e);
  // Use setTimeout so the React Native bridge has time to initialize before Alert.
  setTimeout(() => Alert.alert('Startup Crash', msg, [{ text: 'OK' }]), 500);
}
