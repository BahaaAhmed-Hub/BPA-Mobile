import { useEffect, useState } from 'react';
import { View, Text, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Pressable } from './Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';

/** A bottom sheet that asks for one number. `onSave` resolves true when it was stored; the sheet stays open until then,
 *  so a failed save never looks like a saved one. */
export function ValueSheet({ visible, title, hint, label, initial, suffix, onClose, onSave }: {
  visible: boolean; title: string; hint?: string; label: string; initial?: number | null; suffix?: string;
  onClose: () => void; onSave: (value: number) => Promise<boolean>;
}) {
  const P = useScreenPalette();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setText(initial ? String(initial) : ''); }, [visible, initial]);

  const value = Number(text.replace(/,/g, '').trim());
  const valid = text.trim() !== '' && isFinite(value) && value > 0;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSave(value);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.5)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: P.surface, padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 12 }}>
            <Text style={{ fontFamily: UIFont.bold, fontSize: 18, color: P.ink }}>{title}</Text>
            {hint ? <Text style={{ fontFamily: UIFont.regular, fontSize: 13, lineHeight: 18, color: P.ink3 }}>{hint}</Text> : null}
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.4 }}>{label.toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.bg, borderRadius: Radii.sm, borderWidth: 1, borderColor: P.hairline, paddingHorizontal: 14 }}>
              <TextInput
                value={text} onChangeText={setText} keyboardType="decimal-pad" autoFocus
                accessibilityLabel={label} placeholderTextColor={P.ink3} placeholder="0"
                style={{ flex: 1, paddingVertical: 14, fontFamily: NumFont.bold, fontSize: 20, color: P.ink }}
              />
              {suffix ? <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink3 }}>{suffix}</Text> : null}
            </View>
            <Pressable accessibilityLabel="Save" onPress={() => void save()} disabled={!valid || saving}
              style={{ backgroundColor: valid && !saving ? P.accent : P.hairline, borderRadius: Radii.sm, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: valid && !saving ? P.ink : P.ink3 }}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
