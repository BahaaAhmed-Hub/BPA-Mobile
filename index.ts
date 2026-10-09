import { registerRootComponent } from 'expo';
import { Alert } from 'react-native';
import App from './App';

// Catch JS errors that crash before React renders and surface them as alerts
const origHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  Alert.alert(
    isFatal ? 'Fatal JS Error' : 'JS Error',
    `${error?.message ?? String(error)}\n\n${error?.stack?.slice(0, 400) ?? ''}`,
    [{ text: 'OK' }],
  );
  origHandler?.(error, isFatal);
});

registerRootComponent(App);
