// Google sign-in via Supabase OAuth (browser flow on mobile).
// Mirrors the web app's signInWithGoogle but uses expo-web-browser + deep links
// so the OAuth callback returns to the app instead of staying in the browser.
//
// The same Google scopes are requested so Calendar / Gmail / Drive APIs will work
// once we add those modules in a later phase.

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ');

/**
 * Start the Supabase + Google OAuth flow. Opens an in-app browser, lets the
 * user pick a Google account, then redirects back to the app via the custom
 * URL scheme defined in app.json. Resolves once the session is set.
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth-callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: GOOGLE_SCOPES,
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Supabase did not return an OAuth URL');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return;
  await handleAuthCallback(result.url);
}

/**
 * Parse a Supabase OAuth callback URL and set the session.
 * Supabase appends tokens to the URL fragment (`#access_token=...&refresh_token=...`),
 * which `Linking.parse` does not surface consistently across iOS/Android.
 */
export async function handleAuthCallback(url: string): Promise<void> {
  const fragment = url.split('#')[1] ?? url.split('?')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const access_token  = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return;
  await supabase.auth.setSession({ access_token, refresh_token });
  // Capture the Google provider token from the same callback so the calendar
  // sync Edge Function can use it. The supabase-js session also surfaces it via
  // provider_token / provider_refresh_token — register both with the existing
  // google-oauth Edge Function so the web app's plumbing keeps working too.
  const provider_token         = params.get('provider_token');
  const provider_refresh_token = params.get('provider_refresh_token');
  if (provider_token) await registerPrimaryGoogle(provider_token, provider_refresh_token);
}

/**
 * Hand the Google access token (and optionally refresh token) to the
 * google-oauth Edge Function the web app already has — it stores them
 * server-side under the primary user so google-calendar-sync can use them.
 */
async function registerPrimaryGoogle(accessToken: string, refreshToken: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const body: Record<string, unknown> = {
    action: 'save_primary',
    email: user.email,
    name:  (user.user_metadata?.full_name as string | undefined) ?? null,
    avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    access_token: accessToken,
    expires_at: new Date(Date.now() + 3500 * 1000).toISOString(),
    scopes: ['calendar', 'calendar.events', 'gmail.readonly'],
  };
  if (refreshToken) body.refresh_token = refreshToken;
  const { error } = await supabase.functions.invoke('google-oauth', { body });
  if (error) console.warn('[google] save_primary failed:', error.message);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
