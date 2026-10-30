import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useAuthStore } from '../../store/authStore';
import {
  archiveConversation, claimTool, createConversation, deleteMessageByClientId, fetchLatestConversationId,
  fetchMessages, finishTool, insertUserMessage, markInterrupted, refreshClaim, requestStep, subscribeMessages,
} from './chatApi';
import {
  awaitingContinue, busyOf, claimable, isStaleStreaming, mergeRows, rowsToBubbles, type Bubble, type ChatRow,
} from './chatView';
import { approvalFor, DECLINED, type Approval } from './gate';
import { loadAssistantSettings } from './config';
import type { AssistantSettings } from './settings';
import { buildSystemPrompt } from './prompt';
import { ASSISTANT_TOOLS, executeTool, refreshCalendarSoon } from './tools';

/** Which device took a tool call. Kept so a restarted app recognises its own stale claim. */
let deviceCache: string | null = null;
async function deviceId(): Promise<string> {
  if (deviceCache) return deviceCache;
  try {
    let id = await AsyncStorage.getItem('assistant-device');
    if (!id) { id = Crypto.randomUUID(); await AsyncStorage.setItem('assistant-device', id); }
    deviceCache = id;
  } catch { deviceCache = `ephemeral-${Math.random().toString(36).slice(2)}`; }
  return deviceCache;
}

/** Groq speaks the OpenAI tool format, Anthropic its own. */
const toGroqTools = (tools: typeof ASSISTANT_TOOLS) =>
  tools.map(t => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.input_schema } }));

export interface PendingApproval extends Approval { resolve: (ok: boolean) => void }

export function useAssistant() {
  const user = useAuthStore(s => s.user);
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [tick, setTick] = useState(0);

  const rowsRef = useRef<ChatRow[]>([]);
  const convRef = useRef<string | null>(null);
  const awaitingAfter = useRef<number | null>(null);
  const executing = useRef(new Set<number>());
  const continueAsked = useRef<{ sig: string; at: number; n: number } | null>(null);
  const interrupted = useRef(new Set<number>());
  const lastRefresh = useRef(0);
  const approvalRef = useRef<PendingApproval | null>(null);
  approvalRef.current = approval;

  // Leaving the screen with a card open is not an approval: nothing runs, and the model is told it was declined.
  useEffect(() => () => { approvalRef.current?.resolve(false); }, []);

  const applyRows = useCallback((next: ChatRow[]) => { rowsRef.current = next; setRows(next); }, []);

  const attach = useCallback((id: string, got: ChatRow[]) => {
    convRef.current = id; setConvId(id); applyRows(got);
  }, [applyRows]);

  // ── Load: the settings, then this person's newest thread (which may have begun on the web) ──
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      setSettings(await loadAssistantSettings());
      const id = await fetchLatestConversationId(user.id);
      if (id && alive) { const got = await fetchMessages(id); if (got && alive) attach(id, got); }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [user, attach]);

  const refresh = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastRefresh.current < 1000) return;
    lastRefresh.current = now;
    let id = convRef.current;
    if (!id && user) { id = await fetchLatestConversationId(user.id); if (!id || convRef.current) return; }
    if (!id) return;
    const got = await fetchMessages(id);
    if (!got) return;
    if (!convRef.current) attach(id, got); else if (convRef.current === id) applyRows(got);
  }, [user, attach, applyRows]);

  // Coming back to the app reads the thread again: the websocket does not survive being backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void refresh(true); });
    return () => sub.remove();
  }, [refresh]);

  // Rows arrive by Realtime.
  useEffect(() => {
    if (!convId) return;
    return subscribeMessages(convId, got => applyRows(mergeRows(rowsRef.current, got)), gone => applyRows(rowsRef.current.filter(r => r.id !== gone)));
  }, [convId, applyRows]);

  const now = Date.now();
  const busy = sending || awaitingAfter.current !== null || busyOf(rows, now);

  // While an answer is on its way, a poll backs Realtime up, and a clock lets "interrupted" be noticed.
  useEffect(() => {
    if (!convId || !busy) return;
    const poll = setInterval(() => void refresh(true), 2500);
    const clock = setInterval(() => setTick(t => t + 1), 5000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [convId, busy, refresh]);

  // An answer nobody is writing any more is over; say so on every device.
  useEffect(() => {
    for (const r of rows) {
      if (isStaleStreaming(r, Date.now()) && !interrupted.current.has(r.id)) { interrupted.current.add(r.id); void markInterrupted(r.id); }
    }
  }, [rows, tick]);

  // The server's answer has begun to appear: release the box.
  useEffect(() => {
    const a = awaitingAfter.current;
    if (a !== null && rows.some(r => r.id > a && r.role !== 'user')) { awaitingAfter.current = null; setTick(t => t + 1); }
  }, [rows]);

  /** What a model step needs from this app, which owns the system prompt and the tool list. */
  const stepBody = useCallback(async (mode: 'turn' | 'continue', conversationId: string) => {
    const cfg = await loadAssistantSettings();
    setSettings(cfg);
    const full = user?.name?.trim() || user?.email || 'there';
    const first = full.includes('@') ? full.split('@')[0] : full.split(/\s+/)[0];
    const groq = cfg.provider === 'groq';
    return {
      conversationId, mode, provider: cfg.provider, model: cfg.model,
      ...(groq ? { maxTokens: 2048 } : {}),
      system: buildSystemPrompt({ userName: first, assistantName: cfg.name, now: new Date(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }),
      tools: (groq ? toGroqTools(ASSISTANT_TOOLS) : ASSISTANT_TOOLS) as unknown[],
    };
  }, [user]);

  /** Every tool call goes through here. A call that cannot be undone shows what it will do and waits for the person;
   *  only a tap runs it, and a refusal is handed back to the model as a refusal. */
  const runTool = useCallback(async (name: string, input: Record<string, unknown>): Promise<unknown> => {
    const need = approvalFor(name, input);
    if (need) {
      const ok = await new Promise<boolean>(resolve => setApproval({ ...need, resolve }));
      setApproval(null);
      if (!ok) return DECLINED;
    }
    const out = await executeTool(name, input);
    if (/calendar_event/.test(name)) refreshCalendarSoon();
    return out;
  }, []);

  // Run the tool calls the model asked for. A call is taken once (a conditional update is the claim).
  useEffect(() => {
    const id = convRef.current;
    if (!id) return;
    void (async () => {
      const dev = await deviceId();
      const todo = claimable(rows, Date.now(), dev).filter(r => !executing.current.has(r.id));
      if (!todo.length) return;
      for (const r of todo) executing.current.add(r.id);
      for (const r of todo) {
        if (!(await claimTool(r.id, dev))) { executing.current.delete(r.id); continue; }
        const beat = setInterval(() => void refreshClaim(r.id, dev), 30_000); // still deciding on the card: keep the claim
        let state: 'done' | 'failed' = 'done';
        let out = '';
        try { out = JSON.stringify(await runTool(r.tool ?? '', (r.tool_input ?? {}) as Record<string, unknown>)) ?? 'null'; }
        catch (e) { state = 'failed'; out = `Error: ${e instanceof Error ? e.message : String(e)}`; }
        clearInterval(beat);
        await finishTool(r.id, state, out);
        applyRows(mergeRows(rowsRef.current, [{ ...r, tool_state: state, tool_result: out, claimed_by: dev, updated_at: new Date().toISOString() }]));
      }
    })();
  }, [rows, applyRows, runTool]);

  // Every tool of a step has come back and nothing has started after: ask for the next step.
  useEffect(() => {
    const id = convRef.current;
    if (!id) return;
    const sig = awaitingContinue(rows);
    if (!sig) return;
    const prev = continueAsked.current;
    if (prev && prev.sig === sig && (Date.now() - prev.at < 30_000 || prev.n >= 3)) return;
    continueAsked.current = { sig, at: Date.now(), n: prev && prev.sig === sig ? prev.n + 1 : 1 };
    void (async () => { await requestStep(await stepBody('continue', id)); })();
  }, [rows, stepBody]);

  // ── Send ──────────────────────────────────────────────────────────────────────
  const send = useCallback(async (text: string): Promise<boolean> => {
    const trimmed = text.trim();
    if (!trimmed || !user) return false;
    setProblem(null);
    setSending(true);
    const clientId = Crypto.randomUUID();
    try {
      const existing = convRef.current;
      const id = existing ?? Crypto.randomUUID();
      const cfg = await loadAssistantSettings();
      if (!existing && !(await createConversation(id, user.id, cfg.provider))) {
        setProblem("Couldn't start a conversation. Check your connection and try again."); return false;
      }
      if (!(await insertUserMessage({ conversationId: id, userId: user.id, clientId, text: trimmed }))) {
        if (!existing) await archiveConversation(id);
        setProblem("Couldn't send that message. Check your connection and try again."); return false;
      }
      const res = await requestStep(await stepBody('turn', id));
      if (res.result !== 'accepted') {
        await deleteMessageByClientId(id, clientId);
        if (!existing) await archiveConversation(id);
        setProblem(res.result === 'offline'
          ? "Couldn't reach the assistant. Check your connection and try again."
          : `The assistant isn't available right now${res.detail ? ` (${res.detail})` : ''}.`);
        return false;
      }
      const got = (await fetchMessages(id)) ?? [];
      if (!existing) attach(id, got); else applyRows(got);
      awaitingAfter.current = Math.max(0, ...got.map(r => r.id));
      // If the answer never starts to show (a slow cold start), do not hold the box shut for ever.
      setTimeout(() => { if (awaitingAfter.current !== null) { awaitingAfter.current = null; setTick(t => t + 1); } }, 30_000);
      return true;
    } finally { setSending(false); }
  }, [user, attach, applyRows, stepBody]);

  const newChat = useCallback(async () => {
    const id = convRef.current;
    convRef.current = null; setConvId(null); applyRows([]); awaitingAfter.current = null; setProblem(null);
    if (id) await archiveConversation(id);
  }, [applyRows]);

  const bubbles: Bubble[] = useMemo(() => rowsToBubbles(rows, Date.now()), [rows, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return { bubbles, busy, loaded, problem, settings, approval, send, newChat, dismissProblem: () => setProblem(null), signedIn: !!user };
}
