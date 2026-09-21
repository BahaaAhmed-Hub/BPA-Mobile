import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Modal, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinanceStore } from '../../store/financeStore';
import { C, Radii, Shadows, Spacing } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { TopBar } from '../../components/atoms/TopBar';
import type { DbFinanceAccount, DbFinanceCategory, DbFinanceTransaction, DbFinanceBudget, DbFinanceBill, DbFinanceGoal, TxType } from '../../types/financeTypes';

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
type SubTab = 'Balance' | 'Today' | 'Financials' | 'Budget' | 'Goals';
const SUB_TABS: SubTab[] = ['Balance', 'Today', 'Financials', 'Budget', 'Goals'];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function FinanceScreen() {
  const P = useScreenPalette();
  const [activeTab, setActiveTab] = useState<SubTab>('Balance');
  const [addOpen, setAddOpen] = useState(false);

  const loadAll   = useFinanceStore(s => s.loadAll);
  const loading   = useFinanceStore(s => s.loading);

  useEffect(() => { void loadAll(); }, [loadAll]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <TopBar
        title="Finance"
        subtitle="Reflect · Balance · Plan"
        right={
          <Pressable
            onPress={() => setAddOpen(true)}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 18 }}>＋</Text>
          </Pressable>
        }
      />

      {/* Sub-tab pills */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}
      >
        {SUB_TABS.map(t => {
          const active = activeTab === t;
          return (
            <Pressable key={t} onPress={() => setActiveTab(t)}>
              <View style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radii.pill,
                backgroundColor: active ? P.ink : P.surface,
                borderWidth: active ? 0 : 1, borderColor: P.hairline,
              }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: active ? P.bg : P.ink }}>
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

  // Split accounts by type
  const paymentAccounts = accounts.filter(a => a.account_type !== 'credit_card');
  const creditCards     = accounts.filter(a => a.account_type === 'credit_card');

  // Net position
  // Held = sum of positive balances of payment/asset/wallet accounts (in EGP, USD ignored for simplicity)
  const heldEGP = paymentAccounts.filter(a => a.currency === 'EGP' && a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const owedEGP = creditCards.filter(a => a.currency === 'EGP').reduce((s, a) => s + Math.abs(a.balance), 0);
  const netEGP  = heldEGP - owedEGP;

  // This month's transactions
  const thisMonth = isoYYYYMM(new Date());
  const monthTxs = transactions.filter(t => t.date.slice(0, 7) === thisMonth && t.currency === 'EGP');

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P.accent} />}
    >
      {/* Net Position hero card */}
      <View style={{
        backgroundColor: C.bgDark, borderRadius: Radii.lg,
        padding: 20, gap: 12,
        ...Shadows.pop,
      }}>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.4 }}>
          NET POSITION
        </Text>
        <Text style={{
          fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -0.8,
          color: netEGP >= 0 ? '#4ADE80' : '#F87171',
        }}>
          {netEGP < 0 ? `(EGP ${Math.abs(netEGP).toLocaleString('en-US', { maximumFractionDigits: 0 })})` : `EGP ${netEGP.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
        </Text>

        {/* Held / Owed bar */}
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>HELD</Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>OWED</Text>
          </View>
          <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
            {owedEGP + heldEGP > 0 ? (
              <View style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${Math.min(100, (heldEGP / (heldEGP + owedEGP)) * 100)}%`,
                backgroundColor: '#4ADE80', borderRadius: 3,
              }} />
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#4ADE80' }}>
              EGP {heldEGP.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#F87171' }}>
              EGP {owedEGP.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>SAFE TO SPEND</Text>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: '#fff', marginTop: 2 }}>
              EGP {heldEGP.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>After unpaid bills</Text>
        </View>
      </View>

      {/* Payment Accounts */}
      {paymentAccounts.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionLabel title="PAYMENT ACCOUNTS" total={fmt(paymentAccounts.filter(a=>a.currency==='EGP').reduce((s,a)=>s+a.balance,0))} P={P} />
          {paymentAccounts.map(a => <AccountRow key={a.id} account={a} P={P} />)}
        </View>
      ) : null}

      {/* Cards Owed */}
      {creditCards.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionLabel
            title="CARDS OWED"
            total={fmt(-creditCards.filter(a=>a.currency==='EGP').reduce((s,a)=>s+Math.abs(a.balance),0))}
            totalColor={C.red}
            P={P}
          />
          {creditCards.map(a => <CardRow key={a.id} account={a} P={P} />)}
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
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: P.ink3, letterSpacing: 1.2 }}>{title}</Text>
      {total ? <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 12, color: totalColor ?? P.ink2 }}>{total}</Text> : null}
    </View>
  );
}

function AccountRow({ account: a, P }: { account: DbFinanceAccount; P: ReturnType<typeof useScreenPalette> }) {
  const isNeg = a.balance < 0;
  return (
    <View style={{
      backgroundColor: P.surface, borderRadius: Radii.md, padding: 14,
      borderWidth: 1, borderColor: P.hairline,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      ...Shadows.card,
    }}>
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: `${a.color}20`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 20 }}>{a.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.ink }}>{a.name}</Text>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: P.ink3, marginTop: 1 }}>{a.bank}</Text>
      </View>
      <Text style={{
        fontFamily: 'JetBrainsMono_500Medium', fontSize: 15,
        color: isNeg ? C.red : P.ink,
      }}>
        {fmt(a.balance, a.currency)}
      </Text>
    </View>
  );
}

function CardRow({ account: a, P }: { account: DbFinanceAccount; P: ReturnType<typeof useScreenPalette> }) {
  const owed = Math.abs(a.balance);
  const limit = a.credit_limit ?? 0;
  const used = limit > 0 ? Math.min(1, owed / limit) : 0;

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
          backgroundColor: `${a.color}20`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 20 }}>{a.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.ink }}>{a.name}</Text>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: P.ink3, marginTop: 1 }}>{a.bank}</Text>
        </View>
        <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 15, color: C.red }}>
          {fmt(-owed, a.currency)}
        </Text>
      </View>
      {limit > 0 ? (
        <View style={{ gap: 4 }}>
          <View style={{ height: 4, backgroundColor: P.hairline, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${used * 100}%`, backgroundColor: used > 0.8 ? C.red : C.orange, borderRadius: 2 }} />
          </View>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: P.ink3 }}>
            {Math.round(used * 100)}% of {fmt(limit, a.currency)} limit used
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
        <Text style={{ fontSize: 16 }}>{cat?.icon ?? (isIncome ? '💰' : '💸')}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.ink }} numberOfLines={1}>{tx.payee || cat?.name || 'Transaction'}</Text>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: P.ink3, marginTop: 1 }}>{dayLabel}{cat ? ` · ${cat.name}` : ''}</Text>
      </View>
      <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 14, color: amtColor }}>
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
  const monthTxs = useMemo(
    () => transactions.filter(t => t.date.startsWith(monthPrefix) && t.currency === 'EGP'),
    [transactions, monthPrefix],
  );

  const monthIn  = monthTxs.filter(t => t.tx_type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthOut = monthTxs.filter(t => t.tx_type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Net per day
  const netByDay = useMemo(() => {
    const m: Record<string, { income: number; expense: number }> = {};
    for (const t of monthTxs) {
      if (!m[t.date]) m[t.date] = { income: 0, expense: 0 };
      if (t.tx_type === 'income')  m[t.date].income  += t.amount;
      if (t.tx_type === 'expense') m[t.date].expense += t.amount;
    }
    return m;
  }, [monthTxs]);

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
        <Pressable onPress={prevMonth} hitSlop={12}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: P.ink3 }}>‹</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: P.ink, letterSpacing: -0.3 }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 12, color: C.red }}>
              OUT ({monthOut.toLocaleString('en-US', { maximumFractionDigits: 0 })})
            </Text>
            <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 12, color: C.green }}>
              IN {monthIn.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>
        <Pressable onPress={nextMonth} hitSlop={12}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: P.ink3 }}>›</Text>
        </Pressable>
      </View>

      {/* Day labels */}
      <View style={{ flexDirection: 'row' }}>
        {DAY_LETTERS.map((l, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingBottom: 6 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: P.ink3 }}>{l}</Text>
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
                      fontFamily: 'Inter_700Bold', fontSize: 14,
                      color: isSelected ? P.bg : isToday ? P.accent : P.ink,
                    }}>{day}</Text>
                    {hasActivity ? (
                      <Text style={{
                        fontFamily: 'JetBrainsMono_500Medium', fontSize: 9, marginTop: 2,
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
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: P.ink2, letterSpacing: 1.2 }}>
          {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
        </Text>
        {selectedTxs.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: P.ink3 }}>Nothing on this day</Text>
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
  const [year, setYear] = useState(new Date().getFullYear());
  const [section, setSection] = useState<'income' | 'expenses'>('income');

  async function handleRefresh() { setRefreshing(true); await onRefresh(); setRefreshing(false); }

  const yearTxs = useMemo(
    () => transactions.filter(t => t.date.startsWith(String(year)) && t.currency === 'EGP'),
    [transactions, year],
  );

  // Group by root category
  const byCategory = useMemo(() => {
    const isExpense = (t: DbFinanceTransaction) => t.tx_type === 'expense' || t.tx_type === 'asset_purchase';
    const isIncome  = (t: DbFinanceTransaction) => t.tx_type === 'income';
    const relevantTxs = yearTxs.filter(section === 'income' ? isIncome : isExpense);

    const acc: Record<string, { cat: DbFinanceCategory | null; total: number }> = {};
    for (const t of relevantTxs) {
      const cat = categories.find(c => c.id === t.category_id) ?? null;
      // Use parent if exists, else category itself
      const rootCat = cat?.parent_id ? (categories.find(c => c.id === cat.parent_id) ?? cat) : cat;
      const key = rootCat?.id ?? 'uncategorized';
      if (!acc[key]) acc[key] = { cat: rootCat, total: 0 };
      acc[key].total += t.amount;
    }
    return Object.values(acc).sort((a, b) => b.total - a.total);
  }, [yearTxs, categories, section]);

  const grandTotal = byCategory.reduce((s, c) => s + c.total, 0);

  const incomeTotal  = useMemo(() => yearTxs.filter(t => t.tx_type === 'income').reduce((s, t) => s + t.amount, 0), [yearTxs]);
  const expenseTotal = useMemo(() => yearTxs.filter(t => t.tx_type === 'expense').reduce((s, t) => s + t.amount, 0), [yearTxs]);
  const net = incomeTotal - expenseTotal;

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P.accent} />}
    >
      {/* Year selector */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <Pressable onPress={() => setYear(y => y - 1)} hitSlop={12}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: P.ink3 }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: P.ink, letterSpacing: -0.3 }}>
          Financials, {year}
        </Text>
        <Pressable onPress={() => setYear(y => y + 1)} hitSlop={12}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: P.ink3 }}>›</Text>
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
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: P.ink3, letterSpacing: 1 }}>INCOME</Text>
            <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 17, color: C.green, marginTop: 2 }}>
              EGP {incomeTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: P.ink3, letterSpacing: 1 }}>EXPENSES</Text>
            <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 17, color: C.red, marginTop: 2 }}>
              ({expenseTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })})
            </Text>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: P.hairline }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: P.ink2 }}>NET THROUGH {MONTH_NAMES[new Date().getMonth()]}</Text>
          <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 18, color: net >= 0 ? C.green : C.red }}>
            {net < 0 ? `(EGP ${Math.abs(net).toLocaleString('en-US', {maximumFractionDigits:0})})` : `EGP ${net.toLocaleString('en-US',{maximumFractionDigits:0})}`}
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
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: active ? color : P.ink2, textTransform: 'capitalize' }}>
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
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: P.ink3 }}>No {section} data for {year}</Text>
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
                    <Text style={{ fontSize: 16 }}>{cat?.icon ?? '📁'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.ink }}>{cat?.name ?? 'Uncategorized'}</Text>
                      <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 14, color: section === 'income' ? C.green : C.red }}>
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
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: P.ink3, marginTop: 3 }}>
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
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: P.ink }}>Total {section}</Text>
            <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 16, color: section === 'income' ? C.green : C.red }}>
              EGP {grandTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
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
  const budgets      = useFinanceStore(s => s.budgets);
  const bills        = useFinanceStore(s => s.bills);
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

  const monthBudgets = useMemo(
    () => budgets.filter(b => b.month === monthKey),
    [budgets, monthKey],
  );

  // Actual spending per category for the viewed month
  const spentByCategory = useMemo(() => {
    const monthTxs = transactions.filter(
      t => t.date.startsWith(monthKey) && t.tx_type === 'expense' && t.currency === 'EGP',
    );
    const acc: Record<string, number> = {};
    for (const t of monthTxs) {
      const key = t.category_id ?? 'uncategorized';
      acc[key] = (acc[key] ?? 0) + t.amount;
    }
    return acc;
  }, [transactions, monthKey]);

  // Today's day number for bills due-soon check
  const todayDay = now.getDate();
  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear();

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P.accent} />}
    >
      {/* Month navigator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={prevMonth} hitSlop={12}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: P.ink3 }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: P.ink, letterSpacing: -0.3 }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={nextMonth} hitSlop={12}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: P.ink3 }}>›</Text>
        </Pressable>
      </View>

      {/* Budget rows */}
      {monthBudgets.length === 0 ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: P.ink3 }}>
            No budgets set for this month
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <SectionLabel title="BUDGETS" P={P} />
          {monthBudgets.map(budget => {
            const cat = categories.find(c => c.id === budget.category_id) ?? null;
            const spent = spentByCategory[budget.category_id ?? 'uncategorized'] ?? 0;
            const pct = budget.planned_amount > 0 ? Math.min(1, spent / budget.planned_amount) : 0;
            const over = spent > budget.planned_amount;
            const barColor = over ? C.red : C.green;
            return (
              <View key={budget.id} style={{
                backgroundColor: P.surface, borderRadius: Radii.md, padding: 14,
                borderWidth: 1, borderColor: P.hairline,
                gap: 8,
                ...Shadows.card,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: cat ? `${cat.color}20` : P.hairline,
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Text style={{ fontSize: 16 }}>{cat?.icon ?? '📁'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.ink }}>
                      {cat?.name ?? 'Uncategorized'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 12, color: P.ink3 }}>
                      planned {budget.currency} {budget.planned_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </Text>
                    <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 13, color: over ? C.red : P.ink2, marginTop: 1 }}>
                      spent {spent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                </View>
                <View style={{ gap: 4 }}>
                  <View style={{ height: 5, backgroundColor: P.hairline, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${pct * 100}%`,
                      backgroundColor: barColor, borderRadius: 3,
                    }} />
                  </View>
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: over ? C.red : P.ink3 }}>
                    {Math.round(pct * 100)}% used{over ? ' — OVER BUDGET' : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Bills section */}
      {bills.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionLabel title="UPCOMING BILLS" P={P} />
          {bills.map(bill => {
            const cat = categories.find(c => c.id === bill.category_id) ?? null;
            const dueSoon = isCurrentMonth && bill.due_day >= todayDay;
            return (
              <View key={bill.id} style={{
                backgroundColor: P.surface, borderRadius: Radii.md, padding: 14,
                borderWidth: 1, borderColor: P.hairline,
                flexDirection: 'row', alignItems: 'center', gap: 10,
                ...Shadows.card,
              }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: cat ? `${cat.color}20` : P.hairline,
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Text style={{ fontSize: 16 }}>{cat?.icon ?? '🧾'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.ink }}>{bill.name}</Text>
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: P.ink3, marginTop: 1 }}>
                    Due day {bill.due_day}
                  </Text>
                </View>
                {dueSoon ? (
                  <View style={{
                    backgroundColor: `${C.orange}20`, borderRadius: Radii.pill,
                    paddingHorizontal: 8, paddingVertical: 3, marginRight: 6,
                  }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: C.orange, letterSpacing: 0.6 }}>
                      DUE SOON
                    </Text>
                  </View>
                ) : null}
                <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 14, color: P.ink }}>
                  {bill.currency} {bill.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─── GOALS TAB ────────────────────────────────────────────────────────────────

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
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: P.ink3 }}>No goals yet</Text>
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
          {row.map(goal => {
            const pct = goal.target_amount > 0
              ? Math.min(1, goal.current_amount / goal.target_amount)
              : 0;
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
                  <Text style={{ fontSize: 28 }}>{goal.icon}</Text>
                  <View style={{
                    backgroundColor: `${goal.color}30`, borderRadius: Radii.pill,
                    paddingHorizontal: 7, paddingVertical: 2,
                  }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: goal.color }}>
                      {Math.round(pct * 100)}%
                    </Text>
                  </View>
                </View>

                {/* Name + sub_label */}
                <View>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: P.ink }} numberOfLines={1}>
                    {goal.name}
                  </Text>
                  {goal.sub_label ? (
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: P.ink3, marginTop: 1 }} numberOfLines={1}>
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
                  <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 13, color: goal.color }}>
                    {goal.current_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: P.ink3 }}>
                    / {goal.target_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
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
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: P.ink }}>Add transaction</Text>

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
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: active ? color : P.ink2, textTransform: 'capitalize' }}>
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
              fontFamily: 'JetBrainsMono_500Medium', fontSize: 22, color: P.ink,
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
              fontFamily: 'Inter_500Medium', fontSize: 15, color: P.ink,
            }}
          />

          {/* Category scroll */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
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
                    <Text style={{ fontSize: 14 }}>{c.icon}</Text>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: active ? c.color : P.ink2 }}>{c.name}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Account picker */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
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
                    <Text style={{ fontSize: 14 }}>{a.emoji}</Text>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: active ? a.color : P.ink2 }}>{a.name}</Text>
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
            <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15 }}>Save</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
