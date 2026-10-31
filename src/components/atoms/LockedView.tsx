import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont } from '../../theme/typography';
import type { LockState } from '../../lib/useBiometricLock';

/** What is drawn while a locked screen has not been opened yet. */
export function LockedView({ name, state, onRetry }: { name: string; state: LockState; onRetry: () => void }) {
  const P = useScreenPalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 40 }}>
        <Lock size={40} color={P.ink3} />
        <Text style={{ fontFamily: UIFont.bold, fontSize: 20, color: P.ink, textAlign: 'center' }}>{name} is locked</Text>
        <Text style={{ fontFamily: UIFont.regular, fontSize: 14, color: P.ink3, textAlign: 'center', lineHeight: 20 }}>
          {state === 'pending' ? 'Authenticating…' : 'Authentication cancelled. Tap to try again.'}
        </Text>
        {state === 'failed' && (
          <Pressable onPress={onRetry} style={{ backgroundColor: P.accent, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 999, borderWidth: 1, borderColor: P.accentBorder }}>
            <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: P.accentInk }}>Unlock {name}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
