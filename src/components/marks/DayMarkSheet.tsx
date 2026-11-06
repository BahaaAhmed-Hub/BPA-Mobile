import { useEffect, useState } from 'react';
import { View, Text, TextInput, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Pressable } from '../atoms/Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { MARK_EMOJIS } from '../../lib/marks/markEmojis';
import { DEFAULT_EMOJI, MAX_MARK_TEXT, firstEmoji, validateMark, type DayMark } from '../../lib/marks/dayNotes';
import { useDayMarksStore } from '../../store/dayMarksStore';

/** Make, change or remove one mark. The emoji is a grid or anything typed or pasted (only the first emoji of what arrives
 *  is kept); the words are optional, so a flag is a mark with none. An achievement can be reworded and stays one. */
export function DayMarkSheet({ date, mark, onClose }: { date: string; mark: DayMark | null; onClose: () => void }) {
  const P = useScreenPalette();
  const addMark = useDayMarksStore(s => s.addMark);
  const updateMark = useDayMarksStore(s => s.updateMark);
  const removeMark = useDayMarksStore(s => s.removeMark);
  const [emoji, setEmoji] = useState(DEFAULT_EMOJI);
  const [text, setText] = useState('');
  const [pasted, setPasted] = useState('');
  const [why, setWhy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = mark !== null || date !== '';

  useEffect(() => { setEmoji(mark?.emoji ?? DEFAULT_EMOJI); setText(mark?.text ?? ''); setPasted(''); setWhy(null); }, [mark, date]);

  function onPaste(v: string) {
    setPasted(v);
    if (!v.trim()) { setWhy(null); return; }
    const e = firstEmoji(v);
    if (e) { setEmoji(e); setWhy(null); } else setWhy('That has no emoji in it. Pick one from the grid, or paste one.');
  }

  async function save() {
    if (busy) return;
    const bad = validateMark({ date: mark?.date ?? date, emoji, text });
    if (bad) { setWhy(bad); return; }
    setBusy(true);
    const r = mark ? await updateMark(mark.id, { emoji, text }) : await addMark({ date, emoji, text });
    setBusy(false);
    if (r.ok) onClose(); else setWhy(r.why);
  }

  function confirmRemove() {
    if (!mark) return;
    Alert.alert('Remove this mark?', mark.text || 'A flag', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void removeMark(mark.id).then(r => { if (r) onClose(); }); } },
    ]);
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.5)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: P.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%' }}>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: UIFont.bold, fontSize: 18, color: P.ink }}>{mark ? 'Change this mark' : 'Mark this day'}</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3 }}>
                {new Date(`${mark?.date ?? date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}. Private: never an event, never sent to Google.
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {MARK_EMOJIS.map(e => (
                  <Pressable key={e} accessibilityLabel={`Use ${e}`} accessibilityState={{ selected: emoji === e }} onPress={() => { setEmoji(e); setWhy(null); }}
                    style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: emoji === e ? P.accentTint : P.bg, borderWidth: 1, borderColor: emoji === e ? P.accent : P.hairline }}>
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput value={pasted} onChangeText={onPaste} placeholder="Or paste any emoji" placeholderTextColor={P.ink3} accessibilityLabel="Paste any emoji"
                style={{ backgroundColor: P.bg, borderWidth: 1, borderColor: P.hairline, borderRadius: Radii.sm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: UIFont.regular, fontSize: 15, color: P.ink }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 30 }}>{emoji}</Text>
                <TextInput value={text} onChangeText={t => { setText(t); setWhy(null); }} placeholder="Add words (optional)" placeholderTextColor={P.ink3} maxLength={MAX_MARK_TEXT} accessibilityLabel="Words for the mark"
                  returnKeyType="done" onSubmitEditing={() => void save()}
                  style={{ flex: 1, backgroundColor: P.bg, borderWidth: 1, borderColor: P.hairline, borderRadius: Radii.sm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: UIFont.regular, fontSize: 15, color: P.ink }} />
              </View>

              {why ? <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.negative }}>{why}</Text> : null}

              <Pressable accessibilityLabel={mark ? 'Save the mark' : 'Add the mark'} onPress={() => void save()} disabled={busy}
                style={{ minHeight: 48, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: P.accent, opacity: busy ? 0.6 : 1 }}>
                <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: P.accentInk }}>{busy ? 'Saving…' : mark ? 'Save' : 'Add mark'}</Text>
              </Pressable>
              {mark ? (
                <Pressable accessibilityLabel="Remove this mark" onPress={confirmRemove} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.negative }}>Remove</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
