import { useEffect, useMemo, useState, useCallback } from 'react';
import { goalPace } from '../../lib/finance/goalPace';
import { View, Text, ScrollView, RefreshControl, Modal, TextInput, FlatList } from 'react-native';
import { Pressable } from '../../components/atoms/Pressable';
import { useBiometricLock } from '../../lib/useBiometricLock';
import { LockedView } from '../../components/atoms/LockedView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinanceStore } from '../../store/financeStore';
import { C, Radii, Shadows, Spacing } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { TopBar } from '../../components/atoms/TopBar';
import { Glyph } from '../../components/atoms/Glyph';
import { liveBalances, positionFrom, groupOf, isSettled, todayISO } from '../../lib/finance/balances';
import { toBase, baseCurrency, rateFor } from '../../lib/finance/fx';
import { ValueSheet } from '../../components/atoms/ValueSheet';
import { repayment, payFromOptions } from '../../lib/finance/loans';
import { notify } from '../../store/feedbackStore';
import { totalsFor, byDay, byCategory as categoryTotals } from '../../lib/finance/flows';
import { buildEnvelopes, sumEnvelopes, canEditAmount, type Envelope } from '../../lib/finance/budget';
import type { DbFinanceAccount, DbFinanceCategory, DbFinanceTransaction, DbFinanceBudget, DbFinanceBill, DbFinanceGoal, TxType } from '../../types/financeTypes';
import { UIFont, NumFont } from '../../theme/typography';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'EGP'): string {
  const abs = Math.abs(amount);
  const s = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return amount < 0 ? `(${currency} ${s})` : `${currency} ${s}`;
}

function fmtCompact(amount: number): string {
  const abs = Math.abs(amount);
  const s = abs >= 1000 ? `${Math.round(abs / 1000)}K` : String(Math.round(abs));
  return amount < 0 ? `(${s})` : s;
}

function isoToday(): string { return new Date().toISOString().slice(0, 10); }
function isoYYYYMM(date: Date): string { return date.toISOString().slice(0, 7); }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LETTERS = ['S','M','T','W','T','F','S'];

// ─── Sub-tab type ─────────────────────────────────────────────────────────────
type SubTab = 'Balance' | 'Today' | 'Financials' | 'Budget' | 'Goals' | 'Reports';
const SUB_TABS: SubTab[] = ['Balance', 'Today', 'Financials', 'Budget', 'Goals', 'Reports'];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function FinanceScreen() {
  const P = useScreenPalette();
  const [activeTab, setActiveTab] = useState<SubTab>('Balance')
  const [addOpen, setAddOpen] = useState(false);
  const loadAll   = useFinanceStore(s => s.loadAll);
  const loading   = useFinanceStore(s => s.loading);

  const { state: authState, authenticate } = useBiometricLock('Unlock Finance');
  useEffect(() => { if (authState === 'unlocked') void loadAll(); }, [authState, loadAll]);

  if (authState !== 'unlocked') return <LockedView name="Finance" state={authState} onRetry={() => void authenticate()} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <TopBar
        title="Finance"
        subtitle="Reflect · Balance · Plan"
        right={
          <Pressable accessibilityLabel="Add entry"
            onPress={() => setAddOpen(true)}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontFamily: UIFont.bold, fontSize: 18, lineHeight: 18 }}>＋</Text>
          </Pressable>
        }
      />

      {/* Sub-tab pills */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 8 }}
      >
        {SUB_TABS.map(t => {
          const active = activeTab === t;
          return (
            <Pressable key={t} onPress={() => setActiveTab(t)}>
              <View style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radii.pill,
                backgroundColor: active ? P.accent : P.surface,
                borderWidth: 1,
                borderColor: active ? P.accentBorder : P.hairline,
              }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: active ? P.accentInk : P.ink2 }}>
                  {t}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeTab === 'Balance'    && <BalanceTab    loading={loading} onRefresh={loadAll} />}
      {activeTab === 'Today'      && <TodayTab      loading={loading} onRefresh={loadAll} />}
      {activeTab === 'Financials' && <FinancialsTab loading={loading} onRefresh={loadAll} />}
      {activeTab === 'Budget'     && <BudgetTab     loading={loading} onRefresh={loadAll} />}
      {activeTab === 'Goals'      && <GoalsTab      loading={loading} onRefresh={loadAll} />}
      {activeTab === 'Reports'    && <ReportsTab    loading={loading} onRefresh={loadAll} />}

      <AddTransactionModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </SafeAreaView>
  );
}

// ─── BALANCE TAB ─────────────────────────────────────────────────────────────

function BalanceTab({ loading, onRefresh }: { loading: boolean; onRefresh: () => Promise<void> }) {
  const P = useScreenPalette();
  const accounts     = useFinanceStore(s => s.accounts);
  const transactions = useFinanceStore(s => s.transactions);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }

  // What each account actually holds now: where it started, plus every paid entry filed against it. The stored
  // figure is only the opening one — reading it directly left every account at whatever it was created with.
  const live = useMemo(() => liveBalances(accounts, transactions), [accounts, transactions]);
  const pos = useMemo(() => positionFrom(accounts, transactions), [accounts, transactions]);
  const balanceOf = (a: DbFinanceAccount) => live.balances.get(a.id) ?? a.balance;
  const base = pos.base;
  const saveRate = useFinanceStore(st => st.saveRate);
  const [rateFor_, setRateFor] = useState<string | null>(null);
  const addTx = useFinanceStore(st => st.addTransaction);
  const [repaying, setRepaying] = useState<DbFinanceAccount | null>(null);
  const [payFrom, setPayFrom] = useState<string | null>(null);
  const foreign = useMemo(() => [...new Set(accounts.map(a => (a.currency || base).toUpperCase()))].filter(c => c !== base.toUpperCase()).sort(), [accounts, base]);
  const inBase = (list: DbFinanceAccount[]) => list.reduce((sum, a) => sum + (toBase(balanceOf(a), a.currency, base) ?? 0), 0);

  // Split the way the web does: spendable accounts, cards, other assets, and money borrowed.
  const paymentAccounts = accounts.filter(a => groupOf(a) === 'payment');
  const creditCards     = accounts.filter(a => groupOf(a) === 'cards');
  const otherAssets     = accounts.filter(a => groupOf(a) === 'assets');
  const openLoans       = accounts.filter(a => groupOf(a) === 'loans' && !isSettled(balanceOf(a)));
  const settledLoans    = accounts.filter(a => groupOf(a) === 'loans').length - openLoans.length;

  /** A line under an account: what is unpaid and due, or what could not be counted. */
  const noteFor = (a: DbFinanceAccount): string | null => {
    const due = live.pending.get(a.id) ?? 0;
    const missing = [...(live.unconverted.get(a.id) ?? [])];
    const parts: string[] = [];
    if (Math.abs(due) >= 0.5) parts.push(`${fmt(due, a.currency)} unpaid and due`);
    if (missing.length) parts.push(`${missing.join(', ')} not counted — no rate set`);
    return parts.length ? parts.join(' · ') : null;
  };

  // This month's transactions
  const thisMonth = isoYYYYMM(new Date());
  const monthTxs = transactions.filter(t => t.date.slice(0, 7) === thisMonth);

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P.accent} />}
    >
      {/* Net Position hero card */}
      <View style={{
        backgroundColor: '#1F1A14', borderRadius: Radii.lg,
        padding: 20, gap: 12,
        ...Shadows.pop,
      }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: 'rgba(255,255,255,0.62)', letterSpacing: 1.6 }}>
          NET POSITION
        </Text>
        <Text style={{
          fontFamily: NumFont.bold, fontSize: 32, letterSpacing: -0.8,
          color: pos.net >= 0 ? '#4ADE80' : '#F87171',
        }}>
          {fmt(pos.net, base)}
        </Text>

        {/* Held / Owed bar */}
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: 'rgba(255,255,255,0.62)', letterSpacing: 1.2 }}>HELD</Text>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: 'rgba(255,255,255,0.62)', letterSpacing: 1.2 }}>OWED</Text>
          </View>
          <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
            {pos.owed + pos.held > 0 ? (
              <View style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${Math.min(100, (pos.held / (pos.held + pos.owed)) * 100)}%`,
                backgroundColor: '#4ADE80', borderRadius: 3,
              }} />
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: '#4ADE80' }}>{fmt(pos.held, base)}</Text>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: '#F87171' }}>{fmt(pos.owed, base)}</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: 'rgba(255,255,255,0.62)', letterSpacing: 1.4 }}>SAFE TO SPEND</Text>
            <Text style={{ fontFamily: NumFont.bold, fontSize: 22, color: '#fff', marginTop: 2 }}>{fmt(pos.spendable, base)}</Text>
          </View>
          <Text style={{ flex: 1, textAlign: 'right', fontFamily: UIFont.regular, fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.62)' }}>
            {pos.committed > 0
              ? `Cash, less ${fmt(pos.committed, base)} dated ahead and unpaid`
              : pos.assets > 0 ? 'Cash only; assets are not counted' : 'Cash, after unpaid bills'}
          </Text>
        </View>
        {pos.unrated.length > 0 ? (
          <Text style={{ fontFamily: UIFont.medium, fontSize: 12, lineHeight: 17, color: '#F5D14E' }}>
            {pos.unrated.join(' and ')} not in these totals — no exchange rate is set. Tap it below to set one.
          </Text>
        ) : null}
      </View>

      {/* Exchange rates: one chip per foreign currency in use. The web keeps the same rates, so a change here shows there. */}
      {foreign.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionLabel title="EXCHANGE RATES" total={`1 unit in ${base}`} P={P} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {foreign.map(cur => {
              const r = rateFor(cur);
              return (
                <Pressable key={cur} accessibilityLabel={r === null ? `Set the ${cur} exchange rate` : `Change the ${cur} exchange rate, now ${r}`} onPress={() => setRateFor(cur)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.pill, backgroundColor: P.surface, borderWidth: 1, borderColor: r === null ? P.accentDeep : P.hairline }}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: r === null ? P.accentDeep : P.ink }}>
                    {cur} {r === null ? 'set rate' : r.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <ValueSheet
        visible={rateFor_ !== null}
        title={`${rateFor_ ?? ''} exchange rate`}
        hint={`How much ${base} one ${rateFor_ ?? ''} is worth. This is the same rate the web uses.`}
        label={`1 ${rateFor_ ?? ''} in ${base}`}
        suffix={base}
        initial={rateFor_ ? rateFor(rateFor_) : null}
        onClose={() => setRateFor(null)}
        onSave={v => saveRate(rateFor_!, v)}
      />

      {/* Pay back: a transfer from cash you hold into the lender, never an expense. */}
      {repaying ? (() => {
        const owed = Math.max(0, -balanceOf(repaying));
        const options = payFromOptions(accounts, repaying);
        const chosen = options.find(o => o.id === payFrom) ?? (options.length === 1 ? options[0] : undefined);
        return (
          <ValueSheet
            visible
            title={`Pay back ${repaying.name}`}
            hint={`${fmt(owed, repaying.currency)} is owed. Paid from an account in ${repaying.currency}; the loan and that account both go down.`}
            label={`Amount in ${repaying.currency}`}
            suffix={repaying.currency}
            initial={Math.round(owed * 100) / 100}
            onClose={() => setRepaying(null)}
            onSave={async v => {
              const check = repayment(chosen, repaying, owed, v, todayISO());
              if (!check.ok) { notify('error', check.reason); return false; }
              return addTx(check.tx);
            }}
          >
            {options.length === 0 ? (
              <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.accentDeep }}>
                You have no {repaying.currency} account to pay from. Repaying across currencies is done on the web.
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.4 }}>PAY FROM</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {options.map(o => {
                    const on = chosen?.id === o.id;
                    return (
                      <Pressable key={o.id} accessibilityLabel={`Pay from ${o.name}`} onPress={() => setPayFrom(o.id)}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.pill, backgroundColor: on ? P.accent : P.bg, borderWidth: 1, borderColor: on ? P.accent : P.hairline }}>
                        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink }}>{o.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ValueSheet>
        );
      })() : null}

      {/* Payment accounts */}
      {paymentAccounts.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionLabel title="PAYMENT ACCOUNTS" total={fmt(inBase(paymentAccounts), base)} P={P} />
          {paymentAccounts.map(a => <AccountRow key={a.id} account={a} balance={balanceOf(a)} note={noteFor(a)} P={P} />)}
        </View>
      ) : null}

      {/* Cards owed */}
      {creditCards.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionLabel title="CARDS OWED" total={fmt(inBase(creditCards), base)} totalColor={C.red} P={P} />
          {creditCards.map(a => <CardRow key={a.id} account={a} balance={balanceOf(a)} note={noteFor(a)} P={P} />)}
        </View>
      ) : null}

      {/* Other assets */}
      {otherAssets.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionLabel title="OTHER ASSETS" total={fmt(inBase(otherAssets), base)} P={P} />
          {otherAssets.map(a => <AccountRow key={a.id} account={a} balance={balanceOf(a)} note={noteFor(a)} P={P} />)}
        </View>
      ) : null}

      {/* Money borrowed: cash in, debt out — and neither is income. */}
      {openLoans.length > 0 || settledLoans > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionLabel title="BORROWED & LOANS OWED" total={openLoans.length ? fmt(inBase(openLoans), base) : undefined} totalColor={C.red} P={P} />
          {openLoans.map(a => <CardRow key={a.id} account={a} balance={balanceOf(a)} note={noteFor(a)} isLoan onPayBack={() => { setPayFrom(null); setRepaying(a); }} P={P} />)}
          {settledLoans > 0 ? (
            <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3, paddingHorizontal: 2 }}>
              {settledLoans} settled loan{settledLoans === 1 ? '' : 's'} not shown
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Recent transactions */}
      {monthTxs.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionLabel title={`THIS MONTH · ${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()}`} P={P} />
          {monthTxs.slice(0, 20).map(t => (
            <TxRow key={t.id} tx={t} P={P} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function SectionLabel({ title, total, totalColor, P }: { title: string; total?: string; totalColor?: string; P: ReturnType<typeof useScreenPalette> }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 }}>
      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6 }}>{title}</Text>
      {total ? <Text style={{ fontFamily: NumFont.semiBold, fontSize: 12, color: totalColor ?? P.ink2 }}>{total}</Text> : null}
    </View>
  );
}

function accountEmoji(a: DbFinanceAccount): string {
  if (a.emoji) return a.emoji;
  switch (a.account_type) {
    case 'credit_card': return '💳';
    case 'asset':       return '🏠';
    case 'wallet':      return '👛';
    default:            return '🏦';
  }
}

/** The web stores some colours as CSS variables (`var(--sb-ink-4)`), which a phone cannot draw. */
function drawable(color: string | null | undefined, fallback: string): string {
  return color && !color.startsWith('var(') ? color : fallback;
}

function accountColor(a: DbFinanceAccount): string {
  // The web stores a CSS variable (`var(--sb-ink-4)`) for some accounts, which a phone cannot draw.
  if (a.color && !a.color.startsWith('var(')) return a.color;
  switch (a.account_type) {
    case 'credit_card': return '#EF4444';
    case 'asset':       return '#8B5CF6';
    case 'wallet':      return '#F59E0B';
    default:            return '#3B82F6';
  }
}

function AccountRow({ account: a, balance, note, P }: { account: DbFinanceAccount; balance: number; note: string | null; P: ReturnType<typeof useScreenPalette> }) {
  const isNeg = balance < 0;
  const emoji = accountEmoji(a);
  const color = accountColor(a);
  return (
    <View style={{
      backgroundColor: P.surface, borderRadius: Radii.md, padding: 14,
      borderWidth: 1, borderColor: P.hairline,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      ...Shadows.card,
    }}>
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: `${color}20`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Glyph icon={emoji} size={20} box={40} color={P.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{a.name}</Text>
        <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3, marginTop: 1 }}>{a.bank}</Text>
        {note ? <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: C.red, marginTop: 2 }}>{note}</Text> : null}
      </View>
      <Text style={{
        fontFamily: NumFont.medium, fontSize: 15,
        color: isNeg ? C.red : P.ink,
      }}>
        {fmt(balance, a.currency)}
      </Text>
    </View>
  );
}

function CardRow({ account: a, balance, note, isLoan = false, onPayBack, P }: { account: DbFinanceAccount; balance: number; note: string | null; isLoan?: boolean; onPayBack?: () => void; P: ReturnType<typeof useScreenPalette> }) {
  // A card in credit is not a debt: only a balance below zero is owed.
  const owed = Math.max(0, -balance);
  const limit = a.credit_limit ?? 0;
  const used = limit > 0 ? Math.min(1, owed / limit) : 0;
  const emoji = accountEmoji(a);
  const color = accountColor(a);

  return (
    <View style={{
      backgroundColor: P.surface, borderRadius: Radii.md, padding: 14,
      borderWidth: 1, borderColor: P.hairline,
      gap: 8,
      ...Shadows.card,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 40, height: 40, borderRadius: 12,
          backgroundColor: `${color}20`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Glyph icon={emoji} size={20} box={40} color={P.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{a.name}</Text>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3, marginTop: 1 }}>{a.bank}</Text>
          {note ? <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: C.red, marginTop: 2 }}>{note}</Text> : null}
        </View>
        <Text style={{ fontFamily: NumFont.medium, fontSize: 15, color: owed > 0 ? C.red : P.ink }}>
          {owed > 0 ? fmt(-owed, a.currency) : fmt(balance, a.currency)}
        </Text>
      </View>
      {isLoan && onPayBack && owed > 0 ? (
        <Pressable accessibilityLabel={`Pay back ${a.name}`} onPress={onPayBack}
          style={{ alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.pill, backgroundColor: P.accent }}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 13, color: P.ink }}>Pay back</Text>
        </Pressable>
      ) : null}
      {!isLoan && limit > 0 ? (
        <View style={{ gap: 4 }}>
          <View style={{ height: 4, backgroundColor: P.hairline, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${used * 100}%`, backgroundColor: used > 0.8 ? C.red : C.orange, borderRadius: 2 }} />
          </View>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: owed > limit ? C.red : P.ink3 }}>
            {owed > limit
              ? `${fmt(owed - limit, a.currency)} over the ${fmt(limit, a.currency)} limit`
              : `${Math.round(used * 100)}% of ${fmt(limit, a.currency)} limit used`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TxRow({ tx, P }: { tx: DbFinanceTransaction; P: ReturnType<typeof useScreenPalette> }) {
  const categories = useFinanceStore(s => s.categories);
  const cat = categories.find(c => c.id === tx.category_id);
  const isExpense = tx.tx_type === 'expense' || tx.tx_type === 'asset_purchase' || tx.tx_type === 'liability_acq';
  const isIncome  = tx.tx_type === 'income'  || tx.tx_type === 'asset_sale'    || tx.tx_type === 'liability_dis';
  const amtColor  = isIncome ? C.green : isExpense ? C.red : P.ink;
  const prefix    = isIncome ? '+' : isExpense ? '' : '→';
  const d = new Date(`${tx.date}T12:00:00`);
  const dayLabel  = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <View style={{
      backgroundColor: P.surface, borderRadius: Radii.md, padding: 12,
      borderWidth: 1, borderColor: P.hairline,
      flexDirection: 'row', alignItems: 'center', gap: 10,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: cat ? `${cat.color}20` : P.hairline,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Glyph icon={cat?.icon ?? (isIncome ? '💰' : '💸')} size={16} box={36} color={cat?.color ?? P.ink} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }} numberOfLines={1}>{tx.payee || cat?.name || 'Transaction'}</Text>
        <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3, marginTop: 1 }}>{dayLabel}{cat ? ` · ${cat.name}` : ''}</Text>
      </View>
      <Text style={{ fontFamily: NumFont.medium, fontSize: 14, color: amtColor }}>
        {prefix}{tx.currency} {tx.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
      </Text>
    </View>
  );
}

// ─── TODAY TAB ────────────────────────────────────────────────────────────────

function TodayTab({ loading, onRefresh }: { loading: boolean; onRefresh: () => Promise<void> }) {
  const P = useScreenPalette();
  const transactions = useFinanceStore(s => s.transactions);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState(isoToday());

  async function handleRefresh() {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // Transactions for the viewed month
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  // Income and spending for the viewed month, in the base currency, filed the way the web files them.
  const monthFlows = useMemo(() => totalsFor(transactions, monthPrefix), [transactions, monthPrefix]);
  const monthIn  = monthFlows.income;
  const monthOut = monthFlows.expense;
  const netByDay = useMemo(() => byDay(transactions, monthPrefix), [transactions, monthPrefix]);

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedTxs = useMemo(
    () => transactions.filter(t => t.date === selectedDay),
    [transactions, selectedDay],
  );

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P.accent} />}
    >
      {/* Month header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityLabel="Previous month" onPress={prevMonth} hitSlop={12}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink3 }}>‹</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.3 }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Text style={{ fontFamily: NumFont.medium, fontSize: 12, color: C.red }}>
              OUT ({monthOut.toLocaleString('en-US', { maximumFractionDigits: 0 })})
            </Text>
            <Text style={{ fontFamily: NumFont.medium, fontSize: 12, color: C.green }}>
              IN {monthIn.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>
        <Pressable accessibilityLabel="Next month" onPress={nextMonth} hitSlop={12}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink3 }}>›</Text>
        </Pressable>
      </View>

      {/* Day labels */}
      <View style={{ flexDirection: 'row' }}>
        {DAY_LETTERS.map((l, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingBottom: 6 }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink3 }}>{l}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={{ gap: 4 }}>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 4 }}>
            {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
              if (!day) return <View key={col} style={{ flex: 1 }} />;
              const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayData = netByDay[iso];
              const isSelected = iso === selectedDay;
              const isToday = iso === isoToday();
              const net = dayData ? dayData.income - dayData.expense : 0;
              const hasActivity = !!dayData;
              return (
                <Pressable key={col} style={{ flex: 1 }} onPress={() => setSelectedDay(iso)}>
                  <View style={{
                    borderRadius: Radii.sm,
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: isToday ? P.accent : P.hairline,
                    backgroundColor: isSelected ? P.ink : 'transparent',
                    paddingVertical: 8, alignItems: 'center', minHeight: 56,
                  }}>
                    <Text style={{
                      fontFamily: UIFont.bold, fontSize: 14,
                      color: isSelected ? P.bg : isToday ? P.accent : P.ink,
                    }}>{day}</Text>
                    {hasActivity ? (
                      <Text style={{
                        fontFamily: NumFont.medium, fontSize: 11, marginTop: 2,
                        color: isSelected ? P.bg : net >= 0 ? C.green : C.red,
                      }} numberOfLines={1}>
                        {fmtCompact(net)}
                      </Text>
                    ) : <View style={{ height: 13 }} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Selected day transactions */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: UIFont.bold, fontSize: 13, color: P.ink2, letterSpacing: 1.2 }}>
          {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
        </Text>
        {selectedTxs.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink3 }}>Nothing on this day</Text>
          </View>
        ) : (
          selectedTxs.map(t => <TxRow key={t.id} tx={t} P={P} />)
        )}
      </View>
    </ScrollView>
  );
}

// ─── FINANCIALS TAB ───────────────────────────────────────────────────────────

function FinancialsTab({ loading, onRefresh }: { loading: boolean; onRefresh: () => Promise<void> }) {
  const P = useScreenPalette();
  const transactions = useFinanceStore(s => s.transactions);
  const categories   = useFinanceStore(s => s.categories);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [section, setSection] = useState<'income' | 'expenses'>('income');

  async function handleRefresh() { setRefreshing(true); await onRefresh(); setRefreshing(false); }

  function prevPeriod() {
    if (viewMode === 'annual') { setYear(y => y - 1); }
    else if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextPeriod() {
    if (viewMode === 'annual') { setYear(y => y + 1); }
    else if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const periodPrefix = viewMode === 'annual'
    ? String(year)
    : `${year}-${String(month + 1).padStart(2, '0')}`;

  // Everything is in the base currency, each entry at the rate it was added at. Only income and spending count:
  // a transfer, a borrowing or a repayment is neither earned nor spent.
  const flows = useMemo(() => totalsFor(transactions, periodPrefix), [transactions, periodPrefix]);
  const byCategory = useMemo(
    () => categoryTotals(transactions, categories, periodPrefix, section === 'income' ? 'income' : 'expense'),
    [transactions, categories, periodPrefix, section],
  );
  const grandTotal = byCategory.reduce((sum, c) => sum + c.total, 0);
  const incomeTotal = flows.income;
  const expenseTotal = flows.expense;
  const net = flows.net;
  const base = baseCurrency();

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P.accent} />}
    >
      {/* View mode toggle */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['annual', 'monthly'] as const).map(m => {
          const active = viewMode === m;
          return (
            <Pressable key={m} onPress={() => setViewMode(m)} style={{ flex: 1 }}>
              <View style={{
                paddingVertical: 9, borderRadius: Radii.sm, alignItems: 'center',
                borderWidth: 1,
                borderColor: active ? P.accentBorder : P.hairline,
                backgroundColor: active ? P.accentTint : P.surface,
              }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: active ? P.ink : P.ink2, textTransform: 'capitalize' }}>
                  {m}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Period navigator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <Pressable accessibilityLabel="Previous period" onPress={prevPeriod} hitSlop={12}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink3 }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.3 }}>
          {viewMode === 'annual' ? String(year) : `${MONTH_NAMES[month]} ${year}`}
        </Text>
        <Pressable accessibilityLabel="Next period" onPress={nextPeriod} hitSlop={12}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink3 }}>›</Text>
        </Pressable>
      </View>

      {/* Net summary card */}
      <View style={{
        backgroundColor: P.surface, borderRadius: Radii.md, padding: 16,
        borderWidth: 1, borderColor: P.hairline, gap: 10,
        ...Shadows.card,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.4 }}>INCOME</Text>
            <Text style={{ fontFamily: NumFont.semiBold, fontSize: 17, color: C.green, marginTop: 2 }}>
              {base} {incomeTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.4 }}>EXPENSES</Text>
            <Text style={{ fontFamily: NumFont.semiBold, fontSize: 17, color: C.red, marginTop: 2 }}>
              ({expenseTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })})
            </Text>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: P.hairline }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink2 }}>
            {viewMode === 'annual' ? `NET THROUGH ${MONTH_NAMES[new Date().getMonth()]}` : `NET · ${MONTH_NAMES[month]} ${year}`}
          </Text>
          <Text style={{ fontFamily: NumFont.semiBold, fontSize: 17, color: net >= 0 ? C.green : C.red }}>
            {net < 0 ? `(${base} ${Math.abs(net).toLocaleString('en-US', {maximumFractionDigits:0})})` : `${base} ${net.toLocaleString('en-US',{maximumFractionDigits:0})}`}
          </Text>
        </View>
      </View>

      {/* Income / Expenses toggle */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['income', 'expenses'] as const).map(s => {
          const active = section === s;
          const color  = s === 'income' ? C.green : C.red;
          return (
            <Pressable key={s} onPress={() => setSection(s)} style={{ flex: 1 }}>
              <View style={{
                paddingVertical: 10, alignItems: 'center', borderRadius: Radii.sm,
                borderWidth: 1,
                borderColor: active ? color : P.hairline,
                backgroundColor: active ? `${color}15` : P.surface,
              }}>
                <Text style={{ fontFamily: UIFont.bold, fontSize: 13, color: active ? color : P.ink2, textTransform: 'capitalize' }}>
                  {s}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Category breakdown */}
      {byCategory.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink3 }}>No {section} data for {year}</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {byCategory.map(({ cat, total }) => {
            const pct = grandTotal > 0 ? total / grandTotal : 0;
            return (
              <View key={cat?.id ?? 'uncat'} style={{
                backgroundColor: P.surface, borderRadius: Radii.md, padding: 14,
                borderWidth: 1, borderColor: P.hairline,
                ...Shadows.card,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: cat ? `${cat.color}20` : P.hairline,
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Glyph icon={cat?.icon ?? '📁'} size={16} box={36} color={cat?.color ?? P.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{cat?.name ?? 'Uncategorized'}</Text>
                      <Text style={{ fontFamily: NumFont.medium, fontSize: 14, color: section === 'income' ? C.green : C.red }}>
                        {total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: P.hairline, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                      <View style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${pct * 100}%`,
                        backgroundColor: cat?.color ?? (section === 'income' ? C.green : C.red),
                        borderRadius: 2,
                      }} />
                    </View>
                    <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink3, marginTop: 3 }}>
                      {Math.round(pct * 100)}% of total {section}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Grand total row */}
          <View style={{
            backgroundColor: section === 'income' ? `${C.green}12` : `${C.red}12`,
            borderRadius: Radii.md, padding: 14,
            borderWidth: 1, borderColor: section === 'income' ? `${C.green}30` : `${C.red}30`,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <Text style={{ fontFamily: UIFont.bold, fontSize: 14, color: P.ink }}>Total {section}</Text>
            <Text style={{ fontFamily: NumFont.medium, fontSize: 16, color: section === 'income' ? C.green : C.red }}>
              {base} {grandTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── BUDGET TAB ───────────────────────────────────────────────────────────────

function BudgetTab({ loading, onRefresh }: { loading: boolean; onRefresh: () => Promise<void> }) {
  const P = useScreenPalette();
  const rules        = useFinanceStore(s => s.budgetRules);
  const transactions = useFinanceStore(s => s.transactions);
  const categories   = useFinanceStore(s => s.categories);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear,  setViewYear]  = useState(now.getFullYear());

  async function handleRefresh() { setRefreshing(true); await onRefresh(); setRefreshing(false); }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  // Budgets are rules the person keeps on the web (one per category). Each envelope is what that category is
  // allowed this month against what has been paid out of it, in the envelope's own currency.
  const env = useMemo(() => buildEnvelopes(categories, transactions, rules, monthKey), [categories, transactions, rules, monthKey]);
  const spend = useMemo(() => sumEnvelopes(env.spending), [env]);
  const earn  = useMemo(() => sumEnvelopes(env.earning), [env]);
  const base = baseCurrency();
  const noBudgetsAnywhere = Object.keys(rules).length === 0;
  const saveBudgetAmount = useFinanceStore(st => st.saveBudgetAmount);
  const [editing, setEditing] = useState<Envelope | null>(null);

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P.accent} />}
    >
      {/* Month navigator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityLabel="Previous month" onPress={prevMonth} hitSlop={12}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink3 }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.3 }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <Pressable accessibilityLabel="Next month" onPress={nextMonth} hitSlop={12}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink3 }}>›</Text>
        </Pressable>
      </View>

      {noBudgetsAnywhere ? (
        <View style={{ padding: 40, alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }}>No budgets yet</Text>
          <Text style={{ fontFamily: UIFont.regular, fontSize: 13, lineHeight: 19, color: P.ink3, textAlign: 'center' }}>
            Budgets are set on the web, under Budget. They appear here once you have set one.
          </Text>
        </View>
      ) : (
        <>
          {/* The month in three lines */}
          <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, padding: 16, gap: 12, borderWidth: 1, borderColor: P.hairline, ...Shadows.card }}>
            <SummaryLine label="Expenses" actual={spend.actual} planned={spend.planned} base={base} color={P.negative} P={P} />
            <SummaryLine label="Income" actual={earn.actual} planned={earn.planned} base={base} color={P.positive} P={P} />
            <View style={{ height: 1, backgroundColor: P.hairline }} />
            <SummaryLine
              label="Left over" actual={earn.actual - spend.actual} planned={earn.planned - spend.planned} base={base}
              color={earn.actual - spend.actual < 0 ? P.negative : P.positive} strong P={P}
            />
            {spend.aside + earn.aside > 0 ? (
              <Text style={{ fontFamily: UIFont.medium, fontSize: 12, lineHeight: 17, color: P.accentDeep }}>
                {spend.aside + earn.aside} envelope{spend.aside + earn.aside === 1 ? '' : 's'} left out — no exchange rate is set for their currency.
              </Text>
            ) : null}
          </View>

          {env.spending.length > 0 ? (
            <View style={{ gap: 10 }}>
              <SectionLabel title="SPENDING" total={`${env.spending.filter(e => e.planned > 0).length} of ${env.spending.length} budgeted`} P={P} />
              {env.spending.map(e => <EnvelopeRow key={e.cat.id} e={e} kind="spending" P={P} onEdit={canEditAmount(rules[e.cat.id]) ? () => setEditing(e) : undefined} />)}
            </View>
          ) : null}

          {env.earning.length > 0 ? (
            <View style={{ gap: 10 }}>
              <SectionLabel title="INCOME" P={P} />
              {env.earning.map(e => <EnvelopeRow key={e.cat.id} e={e} kind="income" P={P} onEdit={canEditAmount(rules[e.cat.id]) ? () => setEditing(e) : undefined} />)}
            </View>
          ) : null}
        </>
      )}
      <ValueSheet
        visible={editing !== null}
        title={editing ? `${editing.cat.name} budget` : 'Budget'}
        hint={`The monthly amount from ${new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} on. Earlier months keep what they were.`}
        label="Amount per month"
        suffix={editing?.cur}
        initial={editing && editing.plannedFrom === 'own' ? editing.planned : null}
        onClose={() => setEditing(null)}
        onSave={v => saveBudgetAmount(editing!.cat.id, monthKey, v)}
      />
    </ScrollView>
  );
}

function SummaryLine({ label, actual, planned, base, color, strong = false, P }: {
  label: string; actual: number; planned: number; base: string; color: string; strong?: boolean; P: ReturnType<typeof useScreenPalette>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: strong ? UIFont.bold : UIFont.semiBold, fontSize: 13, color: P.ink }}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: NumFont.bold, fontSize: strong ? 20 : 17, color }}>{fmt(actual, base)}</Text>
        <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>of {fmt(planned, base)} planned</Text>
      </View>
    </View>
  );
}

/** One envelope: what has been paid out of a category this month against what it is allowed, in its own currency. */
function EnvelopeRow({ e, kind, P, onEdit }: { e: Envelope; kind: 'spending' | 'income'; P: ReturnType<typeof useScreenPalette>; onEdit?: () => void }) {
  const budgeted = e.planned > 0;
  const ratio = budgeted ? e.actual / e.planned : 0;
  const over = kind === 'spending' && budgeted && e.actual > e.planned;
  const bar = kind === 'income' ? C.green : over ? C.red : ratio >= 0.8 ? C.orange : C.green;
  const shown = e.children.filter(c => c.budgeted || c.actual > 0);
  return (
    <Pressable disabled={!onEdit} onPress={onEdit} accessibilityLabel={onEdit ? `Change the budget for ${e.cat.name}` : undefined}
      style={{ backgroundColor: P.surface, borderRadius: Radii.md, padding: 14, gap: 8, borderWidth: 1, borderColor: P.hairline, ...Shadows.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${e.cat.color}20`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Glyph icon={e.cat.icon || '📁'} fallback="📁" size={16} box={36} color={e.cat.color || P.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{e.cat.name}</Text>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: over ? C.red : P.ink3, marginTop: 1 }}>
            {budgeted
              ? over ? `${fmt(e.actual - e.planned, e.cur)} over` : `${fmt(e.planned - e.actual, e.cur)} left`
              : 'No budget set'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: NumFont.bold, fontSize: 15, color: over ? C.red : P.ink }}>{fmt(e.actual, e.cur)}</Text>
          {budgeted ? <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink3 }}>of {fmt(e.planned, e.cur)}</Text> : null}
        </View>
      </View>
      {budgeted ? (
        <View style={{ height: 5, backgroundColor: P.hairline, borderRadius: 3, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, ratio * 100)}%`, backgroundColor: bar, borderRadius: 3 }} />
        </View>
      ) : null}
      {e.currencies.length > 0 ? (
        <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.accentDeep }}>{e.currencies.join(', ')} not counted — no rate set</Text>
      ) : null}
      {shown.length > 0 ? (
        <View style={{ gap: 4, paddingTop: 2 }}>
          {shown.map(c => (
            <View key={c.cat.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>{c.cat.name}</Text>
              <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: c.budgeted && c.actual > c.planned ? C.red : P.ink2 }}>
                {fmt(c.actual, e.cur)}{c.budgeted ? ` of ${fmt(c.planned, c.cur)}` : ''}{c.budgeted && c.actual > c.planned ? ' · over' : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── GOALS TAB ────────────────────────────────────────────────────────────────

/** One line on how a goal is going, from its own saved / target / deadline / monthly amount. */
function paceLine(g: DbFinanceGoal, cur: string): { text: string; warn: boolean } | null {
  const pace = goalPace(g);
  const n = (v: number) => `${v.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${cur}`;
  const month = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  switch (pace.state) {
    case 'reached': return { text: 'Reached', warn: false };
    case 'overdue': return { text: `Deadline passed · ${n(pace.remaining)} to go`, warn: true };
    case 'needs': return { text: `${n(pace.perMonth)} a month to arrive on time`, warn: false };
    case 'projected':
      if (pace.onTrack === false) return { text: `Arrives ${month(pace.arrives)}, after the deadline${pace.perMonthNeeded ? ` · ${n(pace.perMonthNeeded)} a month would make it` : ''}`, warn: true };
      return { text: `On track · arrives ${month(pace.arrives)}`, warn: false };
    default: return null;
  }
}

function GoalsTab({ loading, onRefresh }: { loading: boolean; onRefresh: () => Promise<void> }) {
  const P = useScreenPalette();
  const goals = useFinanceStore(s => s.goals);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() { setRefreshing(true); await onRefresh(); setRefreshing(false); }

  if (goals.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P.accent} />}
      >
        <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink3 }}>No goals yet</Text>
      </ScrollView>
    );
  }

  // 2-column grid
  const rows: DbFinanceGoal[][] = [];
  for (let i = 0; i < goals.length; i += 2) {
    rows.push(goals.slice(i, i + 2));
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 12, paddingTop: 4 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P.accent} />}
    >
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: 12 }}>
          {row.map(rawGoal => {
            const goal = { ...rawGoal, color: drawable(rawGoal.color, P.accentDeep) };
            const cur = (goal.currency || baseCurrency()).toUpperCase();
            const pct = goal.target_amount > 0
              ? Math.min(1, goal.current_amount / goal.target_amount)
              : 0;
            const pace = paceLine(goal, cur);
            return (
              <View key={goal.id} style={{
                flex: 1,
                backgroundColor: `${goal.color}18`,
                borderRadius: Radii.md,
                borderLeftWidth: 3, borderLeftColor: goal.color,
                borderTopWidth: 1, borderTopColor: `${goal.color}30`,
                borderRightWidth: 1, borderRightColor: `${goal.color}30`,
                borderBottomWidth: 1, borderBottomColor: `${goal.color}30`,
                padding: 14,
                gap: 8,
              }}>
                {/* % complete badge top-right */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Glyph icon={goal.icon} size={28} box={36} color={P.ink} />
                  <View style={{
                    backgroundColor: `${goal.color}30`, borderRadius: Radii.pill,
                    paddingHorizontal: 7, paddingVertical: 2,
                  }}>
                    <Text style={{ fontFamily: UIFont.bold, fontSize: 11, color: goal.color }}>
                      {Math.round(pct * 100)}%
                    </Text>
                  </View>
                </View>

                {/* Name + sub_label */}
                <View>
                  <Text style={{ fontFamily: UIFont.bold, fontSize: 14, color: P.ink }} numberOfLines={1}>
                    {goal.name}
                  </Text>
                  {goal.sub_label ? (
                    <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink3, marginTop: 1 }} numberOfLines={1}>
                      {goal.sub_label}
                    </Text>
                  ) : null}
                </View>

                {/* Progress bar */}
                <View style={{ height: 5, backgroundColor: `${goal.color}30`, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${pct * 100}%`,
                    backgroundColor: goal.color, borderRadius: 3,
                  }} />
                </View>

                {/* Amounts */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={{ fontFamily: NumFont.medium, fontSize: 13, color: goal.color }}>
                    {goal.current_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={{ fontFamily: NumFont.medium, fontSize: 11, color: P.ink3 }}>
                    / {goal.target_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} {cur}
                  </Text>
                </View>
                {goal.deadline ? (
                  <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink3 }}>
                    by {new Date(`${goal.deadline}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </Text>
                ) : null}
                {pace ? (
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: pace.warn ? P.negative : P.ink2 }}>
                    {pace.text}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {/* If odd number, fill the second slot */}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </ScrollView>
  );
}

// ─── REPORTS TAB ─────────────────────────────────────────────────────────────

function ReportsTab({ loading, onRefresh }: { loading: boolean; onRefresh: () => Promise<void> }) {
  const P = useScreenPalette();
  const transactions = useFinanceStore(s => s.transactions);
  const categories   = useFinanceStore(s => s.categories);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() { setRefreshing(true); await onRefresh(); setRefreshing(false); }

  const now = new Date();
  const thisMonth = isoYYYYMM(now);

  // Build last 6 months array (oldest first, current last)
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: MONTH_NAMES[d.getMonth()], iso: isoYYYYMM(d), isCurrent: i === 5 };
  });

  // Section 1: monthly expense totals, in the base currency
  const monthlyExpenses = useMemo(() => last6Months.map(m => ({
    ...m,
    total: totalsFor(transactions, m.iso).expense,
  })), [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxExpense = Math.max(...monthlyExpenses.map(m => m.total), 1);

  // Section 2: top 5 categories this month (a sub-category counts towards its parent)
  const { topCategories, totalExpensesThisMonth } = useMemo(() => ({
    topCategories: categoryTotals(transactions, categories, thisMonth, 'expense').slice(0, 5),
    totalExpensesThisMonth: totalsFor(transactions, thisMonth).expense,
  }), [transactions, categories, thisMonth]);

  // Section 3: income vs expenses this month
  const { incomeThisMonth, expensesThisMonth } = useMemo(() => {
    const f = totalsFor(transactions, thisMonth);
    return { incomeThisMonth: f.income, expensesThisMonth: f.expense };
  }, [transactions, thisMonth]);

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P.accent} />}
    >
      {/* ── Section 1: Spending bar chart ── */}
      <View>
        <SectionLabel title="SPENDING · LAST 6 MONTHS" P={P} />
        <View style={{
          backgroundColor: P.surface, borderRadius: Radii.md, padding: 16, marginTop: 8,
          borderWidth: 1, borderColor: P.hairline,
          ...Shadows.card,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 4 }}>
            {monthlyExpenses.map(m => {
              const barH = Math.max(4, (m.total / maxExpense) * 140);
              return (
                <View key={m.iso} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <View style={{
                    width: '100%', height: barH,
                    backgroundColor: m.isCurrent ? P.accent : C.indigo,
                    borderTopLeftRadius: 4, borderTopRightRadius: 4,
                  }} />
                  <Text style={{
                    fontFamily: m.isCurrent ? UIFont.bold : UIFont.regular,
                    fontSize: 11,
                    color: m.isCurrent ? P.ink : P.ink3,
                  }}>
                    {m.label}
                  </Text>
                  <Text style={{ fontFamily: NumFont.medium, fontSize: 11, color: P.ink3 }}>
                    {fmtCompact(m.total)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── Section 2: Top categories ── */}
      <View>
        <SectionLabel title={`TOP CATEGORIES · ${MONTH_NAMES[now.getMonth()].toUpperCase()}`} P={P} />
        <View style={{ gap: 8, marginTop: 8 }}>
          {topCategories.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink3 }}>No expense data this month</Text>
            </View>
          ) : (
            topCategories.map(({ cat, total }) => {
              const pct = totalExpensesThisMonth > 0 ? total / totalExpensesThisMonth : 0;
              return (
                <View key={cat?.id ?? 'uncat'} style={{
                  backgroundColor: P.surface, borderRadius: Radii.md, padding: 14,
                  borderWidth: 1, borderColor: P.hairline,
                  ...Shadows.card,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: cat ? `${cat.color}20` : P.hairline,
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Glyph icon={cat?.icon ?? '📁'} size={16} box={36} color={cat?.color ?? P.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>
                          {cat?.name ?? 'Uncategorized'}
                        </Text>
                        <Text style={{ fontFamily: NumFont.medium, fontSize: 14, color: C.red }}>
                          {total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: P.hairline, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                        <View style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${pct * 100}%`,
                          backgroundColor: cat?.color ?? C.red, borderRadius: 2,
                        }} />
                      </View>
                      <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink3, marginTop: 3 }}>
                        {Math.round(pct * 100)}% of total expenses
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* ── Section 3: Income vs Expenses summary ── */}
      <View>
        <SectionLabel title={`INCOME VS EXPENSES · ${MONTH_NAMES[now.getMonth()].toUpperCase()}`} P={P} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <View style={{
            flex: 1, backgroundColor: P.surface, borderRadius: Radii.md, padding: 16,
            borderWidth: 1, borderColor: P.hairline,
            ...Shadows.card,
          }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.4 }}>INCOME</Text>
            <Text style={{ fontFamily: NumFont.semiBold, fontSize: 17, color: C.green, marginTop: 4 }}>
              {fmt(incomeThisMonth, baseCurrency())}
            </Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: P.surface, borderRadius: Radii.md, padding: 16,
            borderWidth: 1, borderColor: P.hairline,
            ...Shadows.card,
          }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.4 }}>EXPENSES</Text>
            <Text style={{ fontFamily: NumFont.semiBold, fontSize: 17, color: C.red, marginTop: 4 }}>
              {fmt(expensesThisMonth, baseCurrency())}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── ADD TRANSACTION MODAL ───────────────────────────────────────────────────

function AddTransactionModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const P = useScreenPalette();
  const accounts     = useFinanceStore(s => s.accounts);
  const categories   = useFinanceStore(s => s.categories);
  const addTx        = useFinanceStore(s => s.addTransaction);

  const [txType,    setTxType]    = useState<'expense' | 'income'>('expense');
  const [amount,    setAmount]    = useState('');
  const [payee,     setPayee]     = useState('');
  const [note,      setNote]      = useState('');
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [categoryId,setCategoryId]= useState<string | null>(null);

  const filteredCats = categories.filter(c => c.tx_type === txType || c.tx_type === 'both');

  async function save() {
    const n = Number(amount.replace(/,/g, ''));
    if (!n || !accountId) return;
    await addTx({
      account_id: accountId,
      category_id: categoryId,
      amount: n,
      currency: accounts.find(a => a.id === accountId)?.currency ?? 'EGP',
      tx_type: txType,
      payee: payee.trim() || (filteredCats.find(c => c.id === categoryId)?.name ?? 'Transaction'),
      date: isoToday(),
      note: note.trim() || null,
    });
    setAmount(''); setPayee(''); setNote(''); setCategoryId(null);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.5)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: P.surface, padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 14 }}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 18, color: P.ink }}>Add transaction</Text>

          {/* Type toggle */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['expense', 'income'] as const).map(t => {
              const active = txType === t;
              const color  = t === 'income' ? C.green : C.red;
              return (
                <Pressable key={t} onPress={() => setTxType(t)} style={{ flex: 1 }}>
                  <View style={{
                    paddingVertical: 10, alignItems: 'center', borderRadius: Radii.sm,
                    borderWidth: 1,
                    borderColor: active ? color : P.hairline,
                    backgroundColor: active ? `${color}15` : 'transparent',
                  }}>
                    <Text style={{ fontFamily: UIFont.bold, fontSize: 13, color: active ? color : P.ink2, textTransform: 'capitalize' }}>
                      {t}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Amount */}
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Amount"
            placeholderTextColor={P.ink3}
            keyboardType="decimal-pad"
            style={{
              borderWidth: 1, borderColor: P.hairline, borderRadius: Radii.sm,
              paddingHorizontal: 14, paddingVertical: 12,
              fontFamily: NumFont.medium, fontSize: 22, color: P.ink,
              textAlign: 'center',
            }}
          />

          {/* Payee */}
          <TextInput
            value={payee}
            onChangeText={setPayee}
            placeholder="Payee / description"
            placeholderTextColor={P.ink3}
            style={{
              borderWidth: 1, borderColor: P.hairline, borderRadius: Radii.sm,
              paddingHorizontal: 14, paddingVertical: 12,
              fontFamily: UIFont.medium, fontSize: 15, color: P.ink,
            }}
          />

          {/* Category scroll */}
          <ScrollView style={{ flexGrow: 0, flexShrink: 0 }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
            {filteredCats.slice(0, 15).map(c => {
              const active = categoryId === c.id;
              return (
                <Pressable key={c.id} onPress={() => setCategoryId(active ? null : c.id)}>
                  <View style={{
                    flexDirection: 'row', gap: 6, alignItems: 'center',
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill,
                    borderWidth: 1,
                    borderColor: active ? c.color : P.hairline,
                    backgroundColor: active ? `${c.color}20` : 'transparent',
                  }}>
                    <Glyph icon={c.icon} size={14} box={18} color={P.ink} />
                    <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: active ? c.color : P.ink2 }}>{c.name}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Account picker */}
          <ScrollView style={{ flexGrow: 0, flexShrink: 0 }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
            {accounts.filter(a => a.account_type !== 'credit_card').map(a => {
              const active = accountId === a.id;
              return (
                <Pressable key={a.id} onPress={() => setAccountId(a.id)}>
                  <View style={{
                    flexDirection: 'row', gap: 6, alignItems: 'center',
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill,
                    borderWidth: 1,
                    borderColor: active ? a.color : P.hairline,
                    backgroundColor: active ? `${a.color}20` : 'transparent',
                  }}>
                    <Glyph icon={a.emoji} size={14} box={18} color={P.ink} />
                    <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: active ? a.color : P.ink2 }}>{a.name}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Save */}
          <Pressable
            onPress={save}
            disabled={!amount.trim() || !accountId}
            style={{
              backgroundColor: amount.trim() && accountId ? P.accent : P.hairline,
              paddingVertical: 14, borderRadius: Radii.sm, alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontFamily: UIFont.bold, fontSize: 15 }}>Save</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
