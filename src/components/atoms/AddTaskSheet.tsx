import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { C, Radii, Quadrants, QuadrantId } from '../../theme/tokens';
import { useTaskStore } from '../../store/taskStore';

const QUADRANT_ORDER: QuadrantId[] = ['urgent_important', 'important_not_urgent', 'urgent_not_important', 'neither'];

export function AddTaskSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const addTask = useTaskStore(s => s.addTask);
  const [title, setTitle] = useState('');
  const [quadrant, setQuadrant] = useState<QuadrantId>('important_not_urgent');
  const [effort, setEffort] = useState('');

  async function save() {
    const trimmed = title.trim();
    if (!trimmed) return;
    await addTask({
      title: trimmed,
      quadrant,
      effort_minutes: effort ? Number(effort) || null : null,
    });
    setTitle('');
    setEffort('');
    setQuadrant('important_not_urgent');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.5)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: C.card, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14 }}>
              <View style={{ alignItems: 'center', marginTop: -6 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.hairline }} />
              </View>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: C.ink }}>New task</Text>

              <TextInput
                placeholder="What needs to be done?"
                placeholderTextColor={C.ink3}
                value={title}
                onChangeText={setTitle}
                autoFocus
                style={{
                  borderWidth: 1, borderColor: C.hairline,
                  borderRadius: Radii.sm,
                  paddingHorizontal: 14, paddingVertical: 12,
                  fontFamily: 'Inter_500Medium', fontSize: 15, color: C.ink,
                }}
              />

              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: C.ink3, letterSpacing: 1.2 }}>QUADRANT</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {QUADRANT_ORDER.map(id => {
                    const meta = Quadrants[id];
                    const active = quadrant === id;
                    return (
                      <Pressable key={id} onPress={() => setQuadrant(id)}>
                        <View style={{
                          paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.pill,
                          backgroundColor: active ? meta.color : meta.soft,
                        }}>
                          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: active ? '#fff' : meta.color }}>
                            {meta.label}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: C.ink3, letterSpacing: 1.2 }}>EFFORT (MIN)</Text>
                <TextInput
                  placeholder="e.g. 25"
                  placeholderTextColor={C.ink3}
                  value={effort}
                  onChangeText={setEffort}
                  keyboardType="number-pad"
                  style={{
                    borderWidth: 1, borderColor: C.hairline,
                    borderRadius: Radii.sm,
                    paddingHorizontal: 14, paddingVertical: 10,
                    fontFamily: 'JetBrainsMono_500Medium', fontSize: 15, color: C.ink,
                  }}
                />
              </View>

              <Pressable
                onPress={save}
                disabled={!title.trim()}
                style={{
                  backgroundColor: title.trim() ? C.indigo : C.hairline,
                  paddingVertical: 14, borderRadius: Radii.sm, alignItems: 'center', marginTop: 4, marginBottom: 8,
                }}
              >
                <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15 }}>Add task</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
