// Which model the assistant uses, read from the value the web app keeps under
// Settings → AI. Pure, so it is tested without a phone. The API keys that sit in
// the same value are never read out of it: the server finds the key itself.

/** The web app's own default (`ASSISTANT_CLAUDE_MODEL`), used when none was chosen. */
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

export interface AssistantSettings {
  provider: 'anthropic' | 'groq';
  model: string;
  /** What the person calls the assistant, from Settings on the web ('' when never named). */
  name: string;
  /** Whether the choice came from the account or is this app's own fallback. */
  fromAccount: boolean;
}

/** Pure, so it can be tested: the two stored strings in, the settings out. */
export function settingsFrom(aiConfig: string | null | undefined, persona: string | null | undefined): AssistantSettings {
  let provider: 'anthropic' | 'groq' = 'anthropic';
  let model = DEFAULT_CLAUDE_MODEL;
  let found = false;
  try {
    if (aiConfig) {
      const c = JSON.parse(aiConfig) as { provider?: string; claudeModel?: string; groqModel?: string };
      found = true;
      if (c.provider === 'groq') {
        provider = 'groq';
        model = (c.groqModel ?? '').trim() || DEFAULT_GROQ_MODEL;
      } else {
        model = (c.claudeModel ?? '').trim() || DEFAULT_CLAUDE_MODEL;
      }
    }
  } catch { /* an unreadable value is the same as none */ }
  let name = '';
  try {
    if (persona) name = String((JSON.parse(persona) as { name?: unknown }).name ?? '').trim().slice(0, 40);
  } catch { /* none */ }
  return { provider, model, name, fromAccount: found };
}
