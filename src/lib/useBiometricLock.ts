import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export type LockState = 'pending' | 'unlocked' | 'failed';

/** Face ID / Touch ID / passcode, asked when the screen opens. A phone with no biometrics enrolled has nothing to
 *  ask, so it opens; any error is a refusal, never a quiet grant. */
export function useBiometricLock(promptMessage: string): { state: LockState; authenticate: () => Promise<void> } {
  const [state, setState] = useState<LockState>('pending');

  const authenticate = useCallback(async () => {
    setState('pending');
    try {
      if (!(await LocalAuthentication.hasHardwareAsync())) { setState('unlocked'); return; }
      if (!(await LocalAuthentication.isEnrolledAsync())) { setState('unlocked'); return; }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage, fallbackLabel: 'Use PIN', cancelLabel: 'Cancel' });
      setState(result.success ? 'unlocked' : 'failed');
    } catch {
      setState('failed'); // a hardware exception requires an explicit retry
    }
  }, [promptMessage]);

  useEffect(() => { void authenticate(); }, [authenticate]);
  return { state, authenticate };
}
