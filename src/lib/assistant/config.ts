import { supabase } from '../supabase';
import { settingsFrom, DEFAULT_CLAUDE_MODEL, type AssistantSettings } from './settings';

// Which model the assistant uses is the person's choice, made on the web under
// Settings → AI and kept in `users.schedule_rules.shared_prefs` (so it follows
// them to every device). This reads that choice. It never keeps the API keys
// that sit in the same value: the server reads the key itself, and nothing here
// has any use for one.

const FALLBACK: AssistantSettings = { provider: 'anthropic', model: DEFAULT_CLAUDE_MODEL, name: '', fromAccount: false };

let cached: { at: number; value: AssistantSettings } | null = null;
const TTL_MS = 5 * 60_000;

export async function loadAssistantSettings(force = false): Promise<AssistantSettings> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return FALLBACK;
  const { data, error } = await supabase
    .from('users')
    .select('ai:schedule_rules->shared_prefs->>professor-ai-config, persona:schedule_rules->shared_prefs->>assistant-persona')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) return cached?.value ?? FALLBACK;
  const row = data as unknown as { ai?: string | null; persona?: string | null };
  const value = settingsFrom(row.ai, row.persona);
  cached = { at: Date.now(), value };
  return value;
}

export function forgetAssistantSettings() { cached = null; }
