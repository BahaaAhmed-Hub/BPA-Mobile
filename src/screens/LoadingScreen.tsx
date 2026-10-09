import { View, Text, ActivityIndicator } from 'react-native';
import { C } from '../theme/tokens';
import { Logo } from '../components/atoms/Logo';

export function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FF0000', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>NATIVE APP ✓</Text>
      <Logo size={48} />
      <ActivityIndicator color="#fff" />
    </View>
  );
}
