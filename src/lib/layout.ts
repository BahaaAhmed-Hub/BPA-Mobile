import { useWindowDimensions } from 'react-native';

/** True on iPad / tablet / wide-screen — drives sidebar nav and 2-column screens. */
export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= 900;
}
