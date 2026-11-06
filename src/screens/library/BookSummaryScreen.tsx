// A written summary of one book, in a length the person picks. Mirrors the web's Summary dialog.
// Said plainly: it is the model's memory of the book, not the book. Saved a section at a time, so leaving the screen,
// a refused key or a dropped connection keeps what was written and offers to carry on. Regenerating asks first.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable } from '../../components/atoms/Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { useLibraryStore } from '../../store/libraryStore';
import { loadSummary, saveSummary, writeSummary, type LoadResult } from '../../lib/librarySummary';
import {
  LENGTHS, LENGTH_ORDER, docPages, docWords, isComplete, paragraphs, summaryMarkdown, type SummaryDoc, type SummaryLength,
} from '../../lib/librarySummaryPlan';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { Header } from './LibraryScreen';

export function BookSummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'LibrarySummary'>>();
  const P = useScreenPalette();
  const book = useLibraryStore(s => s.books.find(b => b.id === params.bookId));

  const [load, setLoad] = useState<LoadResult | null>(null);
  const [doc, setDoc] = useState<SummaryDoc | null>(null);
  const [length, setLength] = useState<SummaryLength>('standard');
  const [busy, setBusy] = useState<{ index: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [asking, setAsking] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bookId = book?.id;

  useEffect(() => {
    if (!bookId) return;
    let live = true;
    void loadSummary(bookId).then(r => {
      if (!live) return;
      setLoad(r);
      if (r.status === 'ok' && r.doc) { setDoc(r.doc); setLength(r.doc.length); }
    });
    return () => { live = false; };
  }, [bookId]);

  // Leaving stops the writing; what was written is already saved.
  useEffect(() => () => abort.current?.abort(), []);

  if (!book) return null;

  async function run(len: SummaryLength, resume: SummaryDoc | null) {
    const ac = new AbortController();
    abort.current = ac;
    setError(null); setAsking(false); setUnsaved(false);
    setBusy({ index: resume?.sections.length ?? 0, total: resume?.outline.length || LENGTHS[len].sections });
    try {
      await writeSummary({
        book: { id: book!.id, title: book!.title, authors: book!.authors, description: book!.description ?? undefined },
        length: len, resume, signal: ac.signal,
        onStep: (index, total) => setBusy({ index, total }),
        onUpdate: async d => {
          setDoc(d);
          const saved = await saveSummary(d).catch(() => 'error' as const);
          if (saved !== 'ok') setUnsaved(true);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The summary did not work just now.');
    } finally {
      setBusy(null); abort.current = null;
    }
  }

  const ready = load?.status === 'ok';
  const partial = !!doc && doc.outline.length > 0 && !isComplete(doc);
  const plan = LENGTHS[length];
  const note = { fontFamily: UIFont.regular, fontSize: 13, lineHeight: 19, color: P.ink3 } as const;
  const warn = { ...note, color: P.accentDeep } as const;

  const btn = (label: string, onPress: () => void, primary = false, disabled = false) => (
    <Pressable key={label} onPress={onPress} disabled={disabled} accessibilityState={{ disabled }}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radii.pill, backgroundColor: primary ? P.accent : P.surface, borderWidth: 1, borderColor: primary ? P.accentBorder : P.hairline, opacity: disabled ? 0.5 : 1 }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: primary ? P.accentInk : P.ink2 }}>{label}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top', 'bottom']}>
      <Header title="Summary" subtitle={book.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 14 }}>
        {load === null ? <ActivityIndicator color={P.ink3} /> : null}
        {load?.status === 'missing' ? <Text style={warn}>Summaries need the database update 20260046_library_book_media.sql. Nothing was written, so nothing was spent.</Text> : null}
        {load?.status === 'error' ? <Text style={warn}>Could not read the saved summary. Go back and open it again.</Text> : null}

        {ready && !busy && (!doc || asking) ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, letterSpacing: 1.4, color: P.ink4 }}>HOW LONG</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {LENGTH_ORDER.map(v => {
                const on = length === v;
                return (
                  <Pressable key={v} onPress={() => setLength(v)} accessibilityState={{ selected: on }}>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill, backgroundColor: on ? P.accent : P.surface, borderWidth: 1, borderColor: on ? P.accentBorder : P.hairline }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: on ? P.accentInk : P.ink2 }}>{LENGTHS[v].label} · ~{LENGTHS[v].pages} pages</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={note}>About {plan.pages} pages in {plan.sections} sections. It takes {plan.sections + 1} requests to the AI service with your Anthropic key, one section at a time, and each is kept as it arrives.</Text>
            <Text style={note}>The AI writes from what it knows about the book — it is not given the book itself — and says so when it does not know it.{book.description ? ' The About text is passed along to help.' : ' Adding the publisher’s blurb under About gives it more to go on.'}</Text>
            {asking ? <Text style={note}>This replaces the summary you have now.</Text> : null}
          </View>
        ) : null}

        {busy ? (
          <View style={{ gap: 6 }} accessibilityLiveRegion="polite">
            <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.ink2 }}>
              {doc && doc.outline[busy.index] ? `Writing section ${busy.index + 1} of ${busy.total}: ${doc.outline[busy.index].title}` : 'Planning the sections…'}
            </Text>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: P.field, overflow: 'hidden' }}>
              <View style={{ height: 6, width: `${Math.round(((doc?.sections.length ?? 0) / Math.max(1, busy.total)) * 100)}%`, backgroundColor: P.accent }} />
            </View>
          </View>
        ) : null}

        {error ? <Text style={warn}>{error}</Text> : null}
        {unsaved ? <Text style={warn}>This could not be saved, so it will be gone when you leave. Share it first.</Text> : null}

        {doc && doc.sections.length > 0 ? (
          <View style={{ gap: 14 }}>
            <Text style={note}>
              {isComplete(doc) ? `About ${docPages(doc)} pages · ${docWords(doc).toLocaleString()} words · ` : `${doc.sections.length} of ${doc.outline.length} sections · `}
              An AI summary written from the model’s knowledge of the book, not from its text. Check any detail that matters.
            </Text>
            <Text selectable style={{ fontFamily: UIFont.regular, fontStyle: 'italic', fontSize: 15, lineHeight: 23, color: P.ink2, borderLeftWidth: 3, borderLeftColor: P.hairline, paddingLeft: 12 }}>{doc.premise}</Text>
            {doc.sections.map((s, i) => (
              <View key={i} style={{ gap: 8 }}>
                <Text style={{ fontFamily: NumFont.bold, fontSize: 18, color: P.ink, letterSpacing: -0.2 }}>{i + 1}. {s.title}</Text>
                {paragraphs(s.text).map((p, n) => (
                  <Text key={n} selectable style={{ fontFamily: UIFont.regular, fontSize: 15, lineHeight: 24, color: P.ink }}>{p}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {busy ? btn('Stop', () => abort.current?.abort()) : null}
          {ready && !busy && !doc ? btn('Write the summary', () => void run(length, null), true) : null}
          {ready && !busy && asking ? [btn('Keep this one', () => setAsking(false), false), btn('Write it again', () => void run(length, null), true)] : null}
          {ready && !busy && doc && !asking ? [
            partial ? btn(`Continue (${doc.sections.length} of ${doc.outline.length} written)`, () => void run(doc.length, doc), true) : null,
            btn('Share / copy', () => { void Share.share({ title: `${book.title} — summary`, message: summaryMarkdown(book, doc) }); }, false, !doc.sections.length),
            btn('Write again', () => setAsking(true)),
          ] : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
