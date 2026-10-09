import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { C, Radii } from '../../theme/tokens';
import { UIFont, NumFont } from '../../theme/typography';
import { useFinanceStore } from '../../store/financeStore';

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AddExpenseSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const addTransaction = useFinanceStore(s => s.addTransaction);
  const accounts       = useFinanceStore(s => s.accounts);
  const categories     = useFinanceStore(s => s.categories);

  const expenseCategories = categories.filter(c => c.tx_type === 'expense' || c.tx_type === 'both');
  const spendAccounts     = accounts.filter(a => a.account_type !== 'credit_card');

  const [amount, setAmount]     = useState('');
  const [payee, setPayee]       = useState('');
  const [date, setDate]         = useState(todayISO);
  const [categoryId, setCatId]  = useState<string | null>(null);
  const [accountId, setAccId]   = useState<string | null>(() => spendAccounts[0]?.id ?? null);
  const [saving, setSaving]     = useState(false);

  async function save() {
    const amt = parseFloat(amount);
    if (!amt || !payee.trim()) return;
    setSaving(true);
    try {
      await addTransaction({
        account_id: accountId,
        category_id: categoryId,
        amount: amt,
        currency: 'EGP',
        tx_type: 'expense',
        payee: payee.trim(),
        date,
      });
      setAmount(''); setPayee(''); setDate(todayISO()); setCatId(null);
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.5)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable onPress={() => {}}>
            <ScrollView style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
              contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">

              <View style={{ alignItems: 'center', marginTop: -6 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.hairline }} />
              </View>
              <Text style={{ fontFamily: UIFont.bold, fontSize: 18, color: C.ink }}>New expense</Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="AMOUNT (EGP)">
                    <TextInput
                      placeholder="0.00"
                      placeholderTextColor={C.ink3}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      autoFocus
                      style={{ ...inputStyle, fontFamily: NumFont.medium }}
                    />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="DATE">
                    <TextInput
                      placeholder={todayISO()}
                      placeholderTextColor={C.ink3}
                      value={date}
                      onChangeText={setDate}
                      keyboardType="numbers-and-punctuation"
                      style={inputStyle}
                    />
                  </Field>
                </View>
              </View>

              <Field label="PAYEE / MERCHANT">
                <TextInput
                  placeholder="e.g. Carrefour"
                  placeholderTextColor={C.ink3}
                  value={payee}
                  onChangeText={setPayee}
                  style={inputStyle}
                />
              </Field>

              {expenseCategories.length > 0 && (
                <Field label="CATEGORY">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {expenseCategories.slice(0, 12).map(cat => {
                        const active = categoryId === cat.id;
                        return (
                          <Pressable key={cat.id} onPress={() => setCatId(active ? null : cat.id)}>
                            <View style={{
                              paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.pill,
                              backgroundColor: active ? (cat.color || C.negative) : C.negativeTint,
                              borderWidth: active ? 0 : 1, borderColor: C.hairline,
                            }}>
                              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: active ? '#fff' : C.ink2 }}>
                                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </Field>
              )}

              {spendAccounts.length > 1 && (
                <Field label="ACCOUNT">
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {spendAccounts.map(acc => {
                      const active = accountId === acc.id;
                      return (
                        <Pressable key={acc.id} onPress={() => setAccId(acc.id)}>
                          <View style={{
                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.pill,
                            backgroundColor: active ? C.positive : C.positiveTint,
                          }}>
                            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: active ? '#fff' : C.positive }}>
                              {acc.name}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>
              )}

              <Pressable
                onPress={save}
                disabled={!amount || !payee.trim() || saving}
                style={{
                  backgroundColor: (amount && payee.trim()) ? C.negative : C.hairline,
                  paddingVertical: 14, borderRadius: Radii.sm,
                  alignItems: 'center', marginTop: 4, marginBottom: 8,
                }}
              >
                <Text style={{ color: '#fff', fontFamily: UIFont.bold, fontSize: 15 }}>
                  {saving ? 'Saving…' : 'Add expense'}
                </Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: C.ink3, letterSpacing: 1.2 }}>{label}</Text>
      {children}
    </View>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: C.hairline,
  borderRadius: Radii.sm,
  paddingHorizontal: 14, paddingVertical: 12,
  fontFamily: UIFont.medium, fontSize: 15, color: C.ink,
} as const;
