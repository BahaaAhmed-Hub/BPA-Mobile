import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Web app reuses these — same Supabase project.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://gyvgqhaepfsqnydhhbnk.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_RUVaTh2GKj2e91oSBuRQxQ_wgN63A4e';

// SecureStore has a 2KB per-value limit. Supabase session JSON can exceed that
// (especially with provider tokens), so chunk into AsyncStorage on native and
// keep only a short pointer in SecureStore. On web/dev, fall back to AsyncStorage.
const ASYNC_MARKER = '__async__';
const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    const stored = await SecureStore.getItemAsync(key);
    if (stored === ASYNC_MARKER) return AsyncStorage.getItem(key);
    return stored;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
    if (value.length < 2000) { await SecureStore.setItemAsync(key, value); return; }
    await AsyncStorage.setItem(key, value);
    await SecureStore.setItemAsync(key, ASYNC_MARKER);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') { await AsyncStorage.removeItem(key); return; }
    await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: LargeSecureStore as never,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
