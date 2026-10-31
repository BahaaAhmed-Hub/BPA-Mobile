import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { Pressable } from '../../components/atoms/Pressable';
import { LockedView } from '../../components/atoms/LockedView';
import { Glyph } from '../../components/atoms/Glyph';
import { useBiometricLock } from '../../lib/useBiometricLock';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii, Shadows } from '../../theme/tokens';
import { useShoppingStore } from '../../store/shoppingStore';
import { sectionsOf, quantityText } from '../../lib/shopping';
import { drawableColor } from '../../lib/projects';
import type { DbShoppingItem } from '../../types/database';

export function ShoppingScreen() {
  const navigation = useNavigation();
  const P = useScreenPalette();
  // The web keeps Shopping behind the finance lock (it holds prices and budgets), so the phone asks the same.
  const { state: lock, authenticate } = useBiometricLock('Unlock Shopping');
  const groups = useShoppingStore(s => s.groups);
  const items = useShoppingStore(s => s.items);
  const loading = useShoppingStore(s => s.loading);
  const unavailable = useShoppingStore(s => s.unavailable);
  const load = useShoppingStore(s => s.loadFromDB);
  const setBought = useShoppingStore(s => s.setBought);
  const addItem = useShoppingStore(s => s.addItem);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [showBought, setShowBought] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => { if (lock === 'unlocked') void load().then(() => setLoadedOnce(true)); }, [lock, load]);

  const sections = useMemo(() => sectionsOf(groups, items), [groups, items]);
  const visible = sections.filter(s => s.group !== null || s.toBuy.length + s.bought.length > 0);
  const toBuyTotal = items.filter(i => i.status !== 'purchased').length;
  const liveGroups = groups.filter(g => g.status === 'active');

  if (lock !== 'unlocked') return <LockedView name="Shopping" state={lock} onRetry={() => void authenticate()} />;

  async function save() {
    const ok = await addItem({ name, quantity: Number(qty) || 1, group_id: groupId });
    if (ok) { setName(''); setQty(''); setAdding(false); }
  }

  function Row({ item }: { item: DbShoppingItem }) {
    const bought = item.status === 'purchased';
    const q = quantityText(item);
    return (
      <Pressable
        onPress={() => void setBought(item.id, !bought)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: bought }}
        accessibilityLabel={`${item.name}${q ? `, ${q}` : ''}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 52, paddingVertical: 8 }}
      >
        <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: bought ? P.positive : P.ink4, backgroundColor: bought ? P.positive : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {bought ? <Check size={15} color="#fff" strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontFamily: UIFont.medium, fontSize: 15, color: bought ? P.ink3 : P.ink, textDecorationLine: bought ? 'line-through' : 'none' }}>{item.name}</Text>
          {(!bought && (item.category && item.category !== 'General')) || item.notes ? (
            <Text numberOfLines={1} style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 1 }}>
              {[item.category !== 'General' ? item.category : null, item.notes].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {q ? <Text style={{ fontFamily: NumFont.semiBold, fontSize: 14, color: bought ? P.ink4 : P.ink2 }}>{q}</Text> : null}
          {!bought && item.target_price_max ? <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink3 }}>up to {item.target_price_max.toLocaleString('en-US')} {item.currency}</Text> : null}
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Back"
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline }}>
          <ChevronLeft size={22} color={P.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.4 }}>Shopping</Text>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>{toBuyTotal} to buy</Text>
        </View>
        <Pressable onPress={() => setAdding(true)} accessibilityLabel="Add item" disabled={unavailable}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: P.accent, borderWidth: 1, borderColor: P.accentBorder, opacity: unavailable ? 0.4 : 1 }}>
          <Plus size={20} color={P.accentInk} />
        </Pressable>
      </View>

      {!loadedOnce && loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={P.ink3} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80, gap: 14, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={P.accent} />}
        >
          {unavailable ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 16, color: P.ink }}>Shopping is not set up yet</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 13, lineHeight: 19, color: P.ink3, textAlign: 'center' }}>This database doesn't have the shopping tables. Turn Shopping on in the web app.</Text>
            </View>
          ) : items.length === 0 && groups.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 16, color: P.ink }}>Nothing on your list</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 13, lineHeight: 19, color: P.ink3, textAlign: 'center' }}>Tap + to add the first item.</Text>
            </View>
          ) : visible.map(sec => {
            const key = sec.group?.id ?? 'none';
            const color = drawableColor(sec.group?.color, P.accent);
            const open = showBought[key] ?? false;
            return (
              <View key={key} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${color}25`, alignItems: 'center', justifyContent: 'center' }}>
                    <Glyph icon={sec.group?.icon || '🛒'} fallback="🛒" size={15} box={28} color={P.ink} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: NumFont.bold, fontSize: 15, color: P.ink }}>{sec.group?.name ?? 'No list'}</Text>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink3 }}>{sec.toBuy.length} to buy</Text>
                </View>
                <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, overflow: 'hidden', ...Shadows.card }}>
                  {sec.toBuy.length === 0 ? (
                    <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3, padding: 14 }}>{sec.bought.length ? 'All bought.' : 'Nothing here yet.'}</Text>
                  ) : sec.toBuy.map((it, i) => (
                    <View key={it.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: P.hairline }}><Row item={it} /></View>
                  ))}
                  {sec.bought.length > 0 ? (
                    <>
                      <Pressable onPress={() => setShowBought(s => ({ ...s, [key]: !open }))} accessibilityState={{ expanded: open }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 44, borderTopWidth: 1, borderTopColor: P.hairline, backgroundColor: P.field }}>
                        {open ? <ChevronDown size={14} color={P.ink3} /> : <ChevronRight size={14} color={P.ink3} />}
                        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink3 }}>{sec.bought.length} bought</Text>
                      </Pressable>
                      {open ? sec.bought.map(it => <View key={it.id} style={{ borderTopWidth: 1, borderTopColor: P.hairline }}><Row item={it} /></View>) : null}
                    </>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <Pressable onPress={() => setAdding(false)} accessibilityRole="none" style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.5)', justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable onPress={() => {}} accessibilityRole="none">
              <View style={{ backgroundColor: P.surface, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14 }}>
                <Text style={{ fontFamily: NumFont.bold, fontSize: 18, color: P.ink }}>Add item</Text>
                <TextInput autoFocus value={name} onChangeText={setName} placeholder="What do you need?" placeholderTextColor={P.ink4} accessibilityLabel="Item name" returnKeyType="done" onSubmitEditing={() => void save()}
                  style={{ minHeight: 48, borderRadius: Radii.sm + 3, backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline, paddingHorizontal: 14, fontFamily: UIFont.medium, fontSize: 16, color: P.ink }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink3 }}>Quantity</Text>
                  <TextInput value={qty} onChangeText={setQty} placeholder="1" placeholderTextColor={P.ink4} keyboardType="decimal-pad" accessibilityLabel="Quantity"
                    style={{ width: 90, minHeight: 44, borderRadius: Radii.sm + 3, backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline, paddingHorizontal: 12, fontFamily: NumFont.medium, fontSize: 15, color: P.ink }} />
                </View>
                {liveGroups.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
                    {[{ id: null as string | null, name: 'No list' }, ...liveGroups].map(g => {
                      const active = groupId === g.id;
                      return (
                        <Pressable key={g.id ?? 'none'} onPress={() => setGroupId(g.id)} accessibilityState={{ selected: active }}>
                          <View style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radii.pill, backgroundColor: active ? P.accent : P.field, borderWidth: 1, borderColor: active ? P.accentBorder : P.hairline }}>
                            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: active ? P.accentInk : P.ink2 }}>{g.name}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}
                <Pressable onPress={() => void save()} disabled={!name.trim()} accessibilityLabel="Add to list"
                  style={{ minHeight: 50, borderRadius: Radii.sm + 3, alignItems: 'center', justifyContent: 'center', backgroundColor: name.trim() ? P.accent : P.field, borderWidth: 1, borderColor: name.trim() ? P.accentBorder : P.hairline }}>
                  <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: name.trim() ? P.accentInk : P.ink4 }}>Add</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
