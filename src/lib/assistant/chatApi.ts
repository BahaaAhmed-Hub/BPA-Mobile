// The assistant's conversation on the server: the reads and writes the screen
// makes against `assistant_conversations` / `assistant_messages`, and the call
// that asks the `assistant-chat` function for a model step. Ported from the web
// app's assistantChatApi.ts — the same tables and the same function, so a thread
// started on the web continues here and the other way round.
import { supabase } from '../supabase';
import { CLAIM_MS, ADOPT_WITHIN_MS, type ChatRow } from './chatView';

export type StepResult = 'accepted' | 'unavailable' | 'offline';

const COLS = 'id, conversation_id, client_id, role, content, status, tool, tool_state, tool_use_id, tool_input, tool_result, files, created_at, updated_at, claimed_by, claimed_at, usage';

export async function createConversation(id: string, userId: string, provider: 'anthropic' | 'groq'): Promise<boolean> {
  const { error } = await supabase.from('assistant_conversations').insert({ id, user_id: userId, provider });
  return !error;
}

export async function insertUserMessage(p: { conversationId: string; userId: string; clientId: string; text: string }): Promise<boolean> {
  const { error } = await supabase.from('assistant_messages').insert({
    conversation_id: p.conversationId, user_id: p.userId, client_id: p.clientId, role: 'user', content: p.text, status: 'complete',
  });
  // A retried insert (the connection dropped after the server had it) lands on the unique index: that is success.
  return !error || error.code === '23505';
}

export async function deleteMessageByClientId(conversationId: string, clientId: string) {
  await supabase.from('assistant_messages').delete().eq('conversation_id', conversationId).eq('client_id', clientId);
}

export async function fetchMessages(conversationId: string): Promise<ChatRow[] | null> {
  const { data, error } = await supabase.from('assistant_messages').select(COLS)
    .eq('conversation_id', conversationId).order('id', { ascending: false }).limit(300);
  if (error || !Array.isArray(data)) return null;
  return (data as unknown as ChatRow[]).reverse();
}

/** The newest live conversation of this person, if it is recent — how a second device finds the thread. */
export async function fetchLatestConversationId(userId: string): Promise<string | null> {
  const since = new Date(Date.now() - ADOPT_WITHIN_MS).toISOString();
  const { data, error } = await supabase.from('assistant_conversations').select('id')
    .eq('user_id', userId).is('archived_at', null).gte('updated_at', since)
    .order('updated_at', { ascending: false }).limit(1);
  if (error || !Array.isArray(data) || !data.length) return null;
  return (data[0] as { id: string }).id;
}

export async function archiveConversation(id: string) {
  await supabase.from('assistant_conversations').update({ archived_at: new Date().toISOString() }).eq('id', id);
}

/** Take a parked tool call, once. The conditional update is the claim: of two open
 *  devices, only one gets a row back. */
export async function claimTool(rowId: number, device: string): Promise<boolean> {
  const now = Date.now();
  const { data, error } = await supabase.from('assistant_messages')
    .update({ claimed_by: device, claimed_at: new Date(now).toISOString() })
    .eq('id', rowId).eq('tool_state', 'running')
    .or(`claimed_at.is.null,claimed_at.lt.${new Date(now - CLAIM_MS).toISOString()},claimed_by.eq.${device}`)
    .select('id');
  return !error && Array.isArray(data) && data.length > 0;
}

export async function finishTool(rowId: number, state: 'done' | 'failed', result: string) {
  await supabase.from('assistant_messages').update({ tool_state: state, tool_result: result.slice(0, 100_000) }).eq('id', rowId);
}

/** Keep a claim alive while the person is still deciding on an approval card. */
export async function refreshClaim(rowId: number, device: string) {
  await supabase.from('assistant_messages').update({ claimed_at: new Date().toISOString() })
    .eq('id', rowId).eq('claimed_by', device).eq('tool_state', 'running');
}

/** Mark an answer that nobody is writing any more, so every device agrees it is over. */
export async function markInterrupted(rowId: number) {
  await supabase.from('assistant_messages').update({ status: 'error', content: 'This answer was interrupted before it finished. Ask again.' })
    .eq('id', rowId).eq('status', 'streaming');
}

/** Ask the server for the next model step. Resolves once it has been ACCEPTED (not answered). The server uses the
 *  key saved under Settings → AI, so no key is sent from here. */
export async function requestStep(body: {
  conversationId: string; mode: 'turn' | 'continue'; provider: 'anthropic' | 'groq';
  model: string; system: string; tools: unknown[]; maxTokens?: number;
}): Promise<{ result: StepResult; detail?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('assistant-chat', { body });
    if (error) {
      const ctx = (error as { context?: { status?: number; json?: () => Promise<{ error?: string }> } }).context;
      let detail = '';
      try { detail = (await ctx?.json?.())?.error ?? ''; } catch { /* the body was not JSON */ }
      // A status means the server answered and refused; no status means the request never got there.
      return ctx?.status ? { result: 'unavailable', detail: detail || error.message } : { result: 'offline' };
    }
    return (data as { accepted?: boolean } | null)?.accepted === true ? { result: 'accepted' } : { result: 'unavailable' };
  } catch { return { result: 'offline' }; }
}

/** Rows arriving for one conversation. Returns the unsubscribe. */
export function subscribeMessages(conversationId: string, onRows: (rows: ChatRow[]) => void, onGone: (id: number) => void): () => void {
  const ch = supabase.channel(`assistant-${conversationId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assistant_messages', filter: `conversation_id=eq.${conversationId}` }, p => {
      if (p.eventType === 'DELETE') { const id = (p.old as { id?: number }).id; if (typeof id === 'number') onGone(id); }
      else onRows([p.new as ChatRow]);
    })
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}
