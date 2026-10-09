import { View, ActivityIndicator } from 'react-native';
import { C } from '../theme/tokens';
import { Logo } from '../components/atoms/Logo';

export function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Logo size={48} />
      <ActivityIndicator color={C.indigo} />
    </View>
  );
}
