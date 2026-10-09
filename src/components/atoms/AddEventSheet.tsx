import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { C, Radii } from '../../theme/tokens';
import { UIFont, NumFont } from '../../theme/typography';
import { supabase } from '../../lib/supabase';
import { useCalendarStore } from '../../store/calendarStore';

function pad(n: number) { return String(n).padStart(2, '0'); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextHourISO() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return `${pad(d.getHours())}:00`;
}

export function AddEventSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const loadRange = useCalendarStore(s => s.loadRange);
  const [title, setTitle]     = useState('');
  const [date, setDate]       = useState(todayISO);
  const [startT, setStartT]   = useState(nextHourISO);
  const [endT, setEndT]       = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 2);
    return `${pad(d.getHours())}:00`;
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = title.trim();
    if (!trimmed || !date) return;
    setSaving(true);
    const start_time = `${date}T${startT}:00`;
    const end_time   = `${date}T${endT}:00`;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('calendar_events').insert({
      user_id: user?.id,
      title: trimmed,
      start_time,
      end_time,
      google_event_id: null,
      is_synced: false,
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    void loadRange(date, date);
    setTitle(''); setDate(todayISO()); setStartT(nextHourISO());
    onClose();
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
              <Text style={{ fontFamily: UIFont.bold, fontSize: 18, color: C.ink }}>New event</Text>

              <Field label="TITLE">
                <TextInput
                  placeholder="Event name"
                  placeholderTextColor={C.ink3}
                  value={title}
                  onChangeText={setTitle}
                  autoFocus
                  style={inputStyle}
                />
              </Field>

              <Field label="DATE (YYYY-MM-DD)">
                <TextInput
                  placeholder={todayISO()}
                  placeholderTextColor={C.ink3}
                  value={date}
                  onChangeText={setDate}
                  keyboardType="numbers-and-punctuation"
                  style={inputStyle}
                />
              </Field>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="START (HH:MM)">
                    <TextInput
                      placeholder="09:00"
                      placeholderTextColor={C.ink3}
                      value={startT}
                      onChangeText={setStartT}
                      keyboardType="numbers-and-punctuation"
                      style={inputStyle}
                    />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="END (HH:MM)">
                    <TextInput
                      placeholder="10:00"
                      placeholderTextColor={C.ink3}
                      value={endT}
                      onChangeText={setEndT}
                      keyboardType="numbers-and-punctuation"
                      style={inputStyle}
                    />
                  </Field>
                </View>
              </View>

              <Pressable
                onPress={save}
                disabled={!title.trim() || saving}
                style={{
                  backgroundColor: title.trim() ? C.cat4 : C.hairline,
                  paddingVertical: 14, borderRadius: Radii.sm,
                  alignItems: 'center', marginTop: 4, marginBottom: 8,
                }}
              >
                <Text style={{ color: '#fff', fontFamily: UIFont.bold, fontSize: 15 }}>
                  {saving ? 'Saving…' : 'Add event'}
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
