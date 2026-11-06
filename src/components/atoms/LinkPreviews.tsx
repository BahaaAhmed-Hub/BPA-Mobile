import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Linking } from 'react-native';
import { Pressable } from './Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { cachedPreview, findLinks, readPreviews, type LinkPreview } from '../../lib/linkPreview';

/** Everything known about the links in a block of text. The derived half is instant; the server half waits for a pause in typing. */
function useLinkPreviews(text: string): LinkPreview[] {
  const urls = useMemo(() => findLinks(text), [text]);
  const key = urls.join('\n');
  const [read, setRead] = useState<Record<string, LinkPreview>>({});

  useEffect(() => {
    if (!urls.length) return;
    let live = true;
    const t = setTimeout(() => {
      void readPreviews(urls).then(got => { if (live && Object.keys(got).length) setRead(r => ({ ...r, ...got })); });
    }, 700);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => urls.map(u => read[u] ?? cachedPreview(u)).filter(Boolean) as LinkPreview[], [key, read]);
}

function Card({ p }: { p: LinkPreview }) {
  const P = useScreenPalette();
  const [noThumb, setNoThumb] = useState(false);
  const [noIcon, setNoIcon] = useState(false);
  const showThumb = !!p.thumb && !noThumb;
  const letter = (p.host[0] || '?').toUpperCase();

  const mark = p.icon && !noIcon
    ? <Image source={{ uri: p.icon }} onError={() => setNoIcon(true)} style={{ width: 18, height: 18, borderRadius: 3 }} />
    : <Text style={{ fontFamily: UIFont.bold, fontSize: 12, color: P.ink2 }}>{letter}</Text>;

  return (
    <Pressable
      accessibilityLabel={`Open link ${p.title || p.tail}, ${p.host}`}
      onPress={() => { void Linking.openURL(p.url).catch(() => {}); }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10, padding: 7,
        borderRadius: Radii.sm, backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
      }}
    >
      {showThumb ? (
        // A picture that does not load falls back to the site's mark rather than a grey frame.
        <Image source={{ uri: p.thumb }} onError={() => setNoThumb(true)} resizeMode="cover"
          style={{ width: 76, height: 52, borderRadius: 6, backgroundColor: P.bg }} />
      ) : (
        <View style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center' }}>{mark}</View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink }}>{p.title || p.tail}</Text>
        <Text numberOfLines={1} style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3 }}>{p.host}</Text>
      </View>
    </Pressable>
  );
}

export function LinkPreviews({ text }: { text: string }) {
  const previews = useLinkPreviews(text);
  if (!previews.length) return null;
  return <View style={{ gap: 6, marginTop: 8 }}>{previews.map(p => <Card key={p.url} p={p} />)}</View>;
}
