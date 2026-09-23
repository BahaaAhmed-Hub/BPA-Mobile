import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { C, Radii } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { UIFont, NumFont } from '../../theme/typography';

type Msg = { id: string; role: 'user' | 'assistant'; text: string; ts: number };

const STARTER_CHIPS = ['Plan my day', 'What should I focus on?', 'Review my week'];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function TypingBubble() {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '.' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return (
    <View style={{ alignItems: 'flex-start', marginBottom: 12, maxWidth: '85%' }}>
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, fontFamily: UIFont.medium }}>
        ✦ The Professor
      </Text>
      <View
        style={{
          backgroundColor: C.cardDark,
          borderColor: C.hairlineDark,
          borderWidth: 1,
          borderRadius: Radii.md,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: '#fff', fontFamily: UIFont.regular, fontSize: 15, letterSpacing: 2 }}>
          {dots}
        </Text>
      </View>
    </View>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  if (isUser) {
    return (
      <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
        <View
          style={{
            backgroundColor: C.indigo,
            borderRadius: Radii.md,
            paddingHorizontal: 14,
            paddingVertical: 10,
            maxWidth: '78%',
          }}
        >
          <Text style={{ color: '#fff', fontFamily: UIFont.regular, fontSize: 15, lineHeight: 22 }}>
            {msg.text}
          </Text>
        </View>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontFamily: UIFont.regular }}>
          {formatTime(msg.ts)}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'flex-start', marginBottom: 12, maxWidth: '85%' }}>
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, fontFamily: UIFont.medium }}>
        ✦ The Professor
      </Text>
      <View
        style={{
          backgroundColor: C.cardDark,
          borderColor: C.hairlineDark,
          borderWidth: 1,
          borderRadius: Radii.md,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: '#fff', fontFamily: UIFont.regular, fontSize: 15, lineHeight: 22 }}>
          {msg.text}
        </Text>
      </View>
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontFamily: UIFont.regular }}>
        {formatTime(msg.ts)}
      </Text>
    </View>
  );
}

export function PlanningAssistantScreen() {
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList<Msg | 'typing'>>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Msg = { id: Date.now().toString(), role: 'user', text: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('professor-chat', {
        body: { message: trimmed, context: 'mobile' },
      });
      const reply = error
        ? "I'm offline right now. Try again shortly."
        : (data?.reply ?? data?.message ?? 'Thinking…');
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: reply, ts: Date.now() },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Connection error. Check your network.', ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const listData: (Msg | 'typing')[] = loading ? [...messages, 'typing'] : messages;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bgDark }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bgDark }} edges={['top']}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: C.hairlineDark,
          }}
        >
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ marginRight: 12 }}>
            <Text style={{ color: C.indigo, fontSize: 22, fontFamily: UIFont.semiBold }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: NumFont.bold, fontSize: 17, color: '#fff' }}>The Professor</Text>
            <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
              AI Executive Coach
            </Text>
          </View>
        </View>

        {/* Message list */}
        <FlatList
          ref={flatListRef}
          data={listData}
          keyExtractor={(item, index) => (item === 'typing' ? `typing-${index}` : item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
          onContentSizeChange={scrollToBottom}
          ListHeaderComponent={
            messages.length === 0 && !loading ? (
              <View style={{ marginBottom: 24 }}>
                <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 16 }}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: 'rgba(42,63,217,0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>✦</Text>
                  </View>
                  <Text style={{ fontFamily: NumFont.bold, fontSize: 18, color: '#fff', marginBottom: 4 }}>
                    The Professor
                  </Text>
                  <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                    Your AI executive coach.{'\n'}Ask about your day, tasks, or strategy.
                  </Text>
                </View>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 10, letterSpacing: 1.6 }}>
                  SUGGESTIONS
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {STARTER_CHIPS.map(chip => (
                    <Pressable
                      key={chip}
                      onPress={() => void sendMessage(chip)}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? 'rgba(42,63,217,0.3)' : 'rgba(42,63,217,0.15)',
                        borderWidth: 1,
                        borderColor: 'rgba(42,63,217,0.4)',
                        borderRadius: Radii.pill,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                      })}
                    >
                      <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: '#fff' }}>{chip}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (item === 'typing') return <TypingBubble />;
            return <MessageBubble msg={item} />;
          }}
        />

        {/* Input bar */}
        <View
          style={{
            backgroundColor: C.cardDark,
            borderTopWidth: 1,
            borderTopColor: C.hairlineDark,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              color: '#fff',
              fontFamily: UIFont.regular,
              fontSize: 15,
              lineHeight: 22,
              maxHeight: 96,
              paddingVertical: 8,
              paddingHorizontal: 14,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: Radii.md,
              borderWidth: 1,
              borderColor: C.hairlineDark,
            }}
            placeholder="Ask The Professor…"
            placeholderTextColor={C.hairlineDark}
            value={input}
            onChangeText={setInput}
            multiline
            numberOfLines={4}
            returnKeyType="default"
          />
          <Pressable
            onPress={() => void sendMessage(input)}
            disabled={loading || !input.trim()}
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: loading || !input.trim() ? 'rgba(42,63,217,0.4)' : C.indigo,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 20, lineHeight: 22, fontFamily: UIFont.semiBold }}>↑</Text>
            )}
          </Pressable>
        </View>

        <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.cardDark }} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
