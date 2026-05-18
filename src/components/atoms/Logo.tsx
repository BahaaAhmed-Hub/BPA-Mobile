import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 32 }: LogoProps) {
  return (
    <LinearGradient
      colors={['#C0413D', '#8E2A28']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#B23A36',
        shadowOpacity: 0.35,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
      }}
    >
      <View>
        <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
          <Path d="M4 4 L20 20 M20 4 L4 20" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
          <Circle cx={12} cy={12} r={1.6} fill="#fff" />
        </Svg>
      </View>
    </LinearGradient>
  );
}
