import { Image, Linking, Text, View, type TextStyle } from 'react-native';
import { UIFont } from '../../theme/typography';
import { parseBlocks, parseInline } from '../../lib/markdown';

// Just enough Markdown (the parsing is in lib/markdown.ts, which can be tested without a phone) for the assistant's answers on a phone: paragraphs,
// **bold**, `code`, [links](url), "-" and "1." lists, ![images](url). A table —
// which the prompt asks the model not to write — is drawn as plain lines rather
// than as pipes and dashes.

interface Colors { ink: string; muted: string; link: string; chip: string }

function Spans({ text, base, c }: { text: string; base: TextStyle; c: Colors }) {
  return (
    <Text style={base}>
      {parseInline(text).map((s, i) => (
        <Text
          key={i}
          style={[
            s.bold ? { fontFamily: UIFont.semiBold } : null,
            s.code ? { fontFamily: 'Courier', backgroundColor: c.chip } : null,
            s.href ? { color: c.link, textDecorationLine: 'underline' } : null,
          ]}
          onPress={s.href ? () => { if (/^https?:\/\//i.test(s.href!)) void Linking.openURL(s.href!); } : undefined}
          accessibilityRole={s.href ? 'link' : undefined}
        >
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

export function Markdown({ text, colors }: { text: string; colors: Colors }) {
  const base: TextStyle = { fontFamily: UIFont.regular, fontSize: 15, lineHeight: 22, color: colors.ink };
  return (
    <View style={{ gap: 6 }}>
      {parseBlocks(text).map((b, i) => {
        if (b.kind === 'img') {
          // Only an address a tool returned is drawn; a data or http image is fine, anything else is skipped.
          return /^(https?:|data:image)/i.test(b.url)
            ? <Image key={i} source={{ uri: b.url }} accessibilityLabel={b.alt} style={{ width: 120, height: 120, borderRadius: 12 }} resizeMode="cover" />
            : null;
        }
        if (b.kind === 'li') {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8, paddingRight: 4 }}>
              <Text style={[base, { width: 18, color: colors.muted }]}>{b.marker}</Text>
              <View style={{ flex: 1 }}><Spans text={b.text} base={base} c={colors} /></View>
            </View>
          );
        }
        return <Spans key={i} text={b.text} base={base} c={colors} />;
      })}
    </View>
  );
}
