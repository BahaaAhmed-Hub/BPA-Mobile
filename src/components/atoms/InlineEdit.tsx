import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { C, Radii } from '../../theme/tokens';

interface Props {
  label: string;
  value: string | null | undefined;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'email-address' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  monospace?: boolean;
  /** Save handler. Receives the trimmed new value (or null if cleared). */
  onSave: (next: string | null) => void | Promise<void>;
  /** Disable editing for read-only fields (e.g. external/derived data). */
  readOnly?: boolean;
}

/**
 * Display value as a tappable row. On tap, swap in a focused TextInput.
 * On blur or submit, save and return to display mode.
 *
 * One-tap to edit, one-tap-elsewhere to commit. No "edit" button.
 */
export function InlineEdit({
  label, value, placeholder, multiline, keyboardType, autoCapitalize, monospace, onSave, readOnly,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value ?? '');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => { if (!editing) setDraft(value ?? ''); }, [value, editing]);
  useEffect(() => {
    if (editing) {
      // Tiny delay so the layout swap finishes before requestFocus
      const t = setTimeout(() => inputRef.current?.focus(), 16);
      return () => clearTimeout(t);
    }
  }, [editing]);

  async function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next === (value ?? '')) return;
    await onSave(next.length === 0 ? null : next);
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: C.ink3, letterSpacing: 1.2 }}>
        {label.toUpperCase()}
      </Text>
      {editing && !readOnly ? (
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          onBlur={() => void commit()}
          onSubmitEditing={() => { if (!multiline) void commit(); }}
          multiline={multiline}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          placeholder={placeholder}
          placeholderTextColor={C.ink3}
          returnKeyType={multiline ? 'default' : 'done'}
          style={{
            backgroundColor: C.card,
            borderRadius: Radii.sm,
            borderWidth: 1, borderColor: C.indigo,
            paddingHorizontal: 14, paddingVertical: 12,
            fontFamily: monospace ? 'JetBrainsMono_500Medium' : 'Inter_400Regular',
            fontSize: 15, color: C.ink, minHeight: multiline ? 64 : 44,
          }}
        />
      ) : (
        <Pressable onPress={() => { if (!readOnly) setEditing(true); }}>
          <View style={{
            backgroundColor: C.card,
            borderRadius: Radii.sm,
            borderWidth: 1, borderColor: C.hairline,
            paddingHorizontal: 14, paddingVertical: 12,
            minHeight: multiline ? 64 : 44,
            justifyContent: 'center',
            opacity: readOnly ? 0.6 : 1,
          }}>
            <Text style={{
              fontFamily: monospace ? 'JetBrainsMono_500Medium' : 'Inter_400Regular',
              fontSize: 15,
              color: value ? C.ink : C.ink3,
            }}>
              {value ? value : (placeholder ?? `Tap to add ${label.toLowerCase()}`)}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}
