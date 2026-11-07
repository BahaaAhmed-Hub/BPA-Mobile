// Videos about one book, with thumbnails — and a list the person keeps. Mirrors the web's Videos dialog: only videos
// that name this book are shown (looser ones are one press away), favourites and removed videos are per book and kept on
// the server, and when the function cannot answer the person is told why and still has the plain YouTube link.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ExternalLink, Star, X } from 'lucide-react-native';
import { Pressable } from '../../components/atoms/Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { useLibraryStore } from '../../store/libraryStore';
import {
  VIDEO_NOTE, clearMark, findVideos, loadMarks, saveMark, thumbUrl, watchUrl, youtubeSearchUrl,
  type MarkKind, type VideoMark, type VideoResult, type VideoTopic,
} from '../../lib/libraryVideos';
import { SORT_OPTIONS, sortVideos, statsLine, type SortKey } from '../../lib/libraryVideoSort';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { Header } from './LibraryScreen';

type View_ = 'all' | 'favourites' | 'hidden';
type Card = { id: string; title: string; channel: string; publishedAt: string; strict?: boolean; views?: number | null; likes?: number | null };
const STEP = 12;
const TOPICS: { id: VideoTopic; label: string }[] = [{ id: 'review', label: 'Reviews & summaries' }, { id: 'author', label: 'The author' }];

export function BookVideosScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'LibraryVideos'>>();
  const P = useScreenPalette();
  const book = useLibraryStore(s => s.books.find(b => b.id === params.bookId));

  const [topic, setTopic] = useState<VideoTopic>('review');
  const [answer, setAnswer] = useState<{ key: string; result: VideoResult } | null>(null);
  const [again, setAgain] = useState(0);
  const [view, setView] = useState<View_>('all');
  const [looser, setLooser] = useState(false);
  const [sort, setSort] = useState<SortKey>('watched');
  const [shown, setShown] = useState(STEP);
  const [searchingMore, setSearchingMore] = useState(false);
  const [marks, setMarks] = useState<VideoMark[]>([]);
  const [marksState, setMarksState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [note, setNote] = useState('');

  const bookId = book?.id; const title = book?.title ?? ''; const authorsKey = (book?.authors ?? []).join('|');
  const key = `${bookId}|${topic}|${again}`;
  const result = answer?.key === key ? answer.result : null;
  const loading = result === null;

  useEffect(() => {
    if (!bookId) return;
    let live = true;
    void findVideos({ id: bookId, title, authors: authorsKey ? authorsKey.split('|') : [] }, topic).then(r => { if (live) setAnswer({ key, result: r }); });
    return () => { live = false; };
  }, [bookId, title, authorsKey, topic, key]);

  useEffect(() => {
    if (!bookId) return;
    let live = true;
    void loadMarks(bookId).then(r => {
      if (!live) return;
      if (r.status === 'ok') { setMarks(r.marks); setMarksState('ok'); } else setMarksState(r.status);
    });
    return () => { live = false; };
  }, [bookId]);

  const byId = useMemo(() => new Map(marks.map(m => [m.videoId, m])), [marks]);
  const favourites = useMemo(() => marks.filter(m => m.mark === 'favorite'), [marks]);
  const removed = useMemo(() => marks.filter(m => m.mark === 'hidden'), [marks]);
  const canMark = marksState === 'ok';

  if (!book) return null;

  const items = result?.status === 'ok' ? result.items : [];
  const notRemoved = items.filter(v => byId.get(v.id)?.mark !== 'hidden');
  // Ordered before it is cut to a page, so "most watched" means the most watched of ALL of them.
  const candidates = sortVideos(notRemoved.filter(v => v.strict || looser), sort);
  const looserCount = notRemoved.filter(v => !v.strict).length;
  const visible = candidates.slice(0, shown);

  /** Optimistic: the card moves at once, and comes back with a sentence if the server said no. */
  async function decide(c: Card, mark: MarkKind | null) {
    const before = marks;
    const row: VideoMark = { videoId: c.id, mark: mark ?? 'favorite', title: c.title, channel: c.channel, publishedAt: c.publishedAt };
    setNote('');
    setMarks(prev => mark ? [row, ...prev.filter(m => m.videoId !== c.id)] : prev.filter(m => m.videoId !== c.id));
    const saved = mark ? await saveMark(book!.id, row).catch(() => 'error' as const) : await clearMark(book!.id, c.id).catch(() => 'error' as const);
    if (saved !== 'ok') { setMarks(before); setNote(saved === 'missing' ? 'Favourites need a database update, so that was not kept.' : 'That could not be saved — it has been put back.'); }
  }

  async function searchMore() {
    setSearchingMore(true); setNote('');
    const r = await findVideos({ id: book!.id, title: book!.title, authors: book!.authors }, topic, true);
    setSearchingMore(false);
    if (r.status !== 'ok') { setNote(VIDEO_NOTE[r.status]); return; }
    setAnswer({ key, result: r });
    if (r.moreStatus) setNote(r.moreStatus === 'quota' ? VIDEO_NOTE.quota : r.moreStatus === 'not_configured' ? VIDEO_NOTE.not_configured : 'YouTube could not be reached just now, so nothing more was added.');
    else setShown(s => s + STEP);
  }

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} accessibilityState={{ selected: on }}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill, backgroundColor: on ? P.accent : P.surface, borderWidth: 1, borderColor: on ? P.accentBorder : P.hairline }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: on ? P.accentInk : P.ink2 }}>{label}</Text>
      </View>
    </Pressable>
  );
  const small = { fontFamily: UIFont.regular, fontSize: 13, lineHeight: 19, color: P.ink3 } as const;
  const warn = { ...small, color: P.accentDeep } as const;

  const card = (c: Card, kind: 'result' | 'favourite' | 'removed') => {
    const fav = byId.get(c.id)?.mark === 'favorite';
    const stats = kind === 'result' ? statsLine({ views: c.views ?? null, likes: c.likes ?? null }) : '';
    const round = { position: 'absolute', top: 8, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline, opacity: canMark ? 1 : 0.5 } as const;
    return (
      <View key={c.id} style={{ gap: 6 }}>
        <Pressable onPress={() => void Linking.openURL(watchUrl(c.id))} accessibilityLabel={`${c.title} — opens on YouTube`} style={{ gap: 6 }}>
          <Image source={{ uri: thumbUrl(c.id) }} accessibilityIgnoresInvertColors resizeMode="cover"
            style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: Radii.md, backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline }} />
          <Text numberOfLines={2} style={{ fontFamily: UIFont.semiBold, fontSize: 14, lineHeight: 19, color: P.ink }}>{c.title}</Text>
          {c.channel ? <Text numberOfLines={1} style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>{c.channel}</Text> : null}
          {stats ? <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>{stats}</Text> : null}
        </Pressable>
        {kind === 'result' && c.strict === false ? <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.accentDeep }}>Looser match — may be about another book</Text> : null}
        {kind !== 'removed' ? (
          <Pressable disabled={!canMark} onPress={() => void decide(c, fav ? null : 'favorite')} accessibilityState={{ selected: fav }}
            accessibilityLabel={`${fav ? 'Remove from favourites' : 'Add to favourites'}: ${c.title}`} style={{ ...round, left: 8 }}>
            <Star size={18} color={fav ? P.accentDeep : P.ink2} fill={fav ? P.accent : 'transparent'} />
          </Pressable>
        ) : null}
        {kind === 'result' ? (
          <Pressable disabled={!canMark} onPress={() => void decide(c, 'hidden')} accessibilityLabel={`Remove from this list: ${c.title}`} style={{ ...round, right: 8 }}>
            <X size={18} color={P.ink2} />
          </Pressable>
        ) : null}
        {kind === 'removed' ? (
          <Pressable onPress={() => void decide(c, null)} accessibilityLabel={`Bring back: ${c.title}`} style={{ alignSelf: 'flex-start' }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill, backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink2 }}>Bring back</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top', 'bottom']}>
      <Header title="Videos" subtitle={book.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {TOPICS.map(t => chip(t.label, topic === t.id, () => { setTopic(t.id); setShown(STEP); setLooser(false); }))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {chip('Results', view === 'all', () => setView('all'))}
          {chip(`Favourites${favourites.length ? ` (${favourites.length})` : ''}`, view === 'favourites', () => setView('favourites'))}
          {chip(`Removed${removed.length ? ` (${removed.length})` : ''}`, view === 'hidden', () => setView('hidden'))}
        </ScrollView>
        {view === 'all' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {SORT_OPTIONS.map(o => chip(o.label, sort === o.value, () => { setSort(o.value); setShown(STEP); }))}
          </ScrollView>
        ) : null}

        {marksState === 'missing' ? <Text style={warn}>Favourites and removing need the database update 20260047_library_video_marks.sql. Videos still show.</Text> : null}
        {marksState === 'error' ? <Text style={warn}>Your favourites could not be read just now.</Text> : null}
        {note ? <Text style={warn} accessibilityLiveRegion="polite">{note}</Text> : null}

        {view === 'all' ? (
          <>
            {loading ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><ActivityIndicator color={P.ink3} /><Text style={small}>Looking on YouTube…</Text></View> : null}
            {result && result.status !== 'ok' ? <Text style={small}>{VIDEO_NOTE[result.status]} You can still search YouTube yourself.</Text> : null}
            {result?.status === 'ok' && result.stale ? <Text style={small}>Showing an earlier search — YouTube could not be reached just now.</Text> : null}
            {result?.status === 'ok' && items.length === 0 ? <Text style={small}>No videos found for this book.</Text> : null}
            {result?.status === 'ok' && items.length > 0 && candidates.length === 0
              ? <Text style={small}>None of the results names this book{looserCount ? ` — ${looserCount} looser match${looserCount === 1 ? '' : 'es'} hidden` : ''}.</Text> : null}
            {visible.map(v => card(v, 'result'))}
            {result?.status === 'ok' && items.length > 0 ? (
              <View style={{ gap: 8, alignItems: 'flex-start' }}>
                <Text style={small}>Showing {visible.length} of {candidates.length} that name this book{canMark && removed.length ? ` · ${removed.length} removed` : ''}.</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {candidates.length > shown ? chip(`Show more (${candidates.length - shown} left)`, false, () => setShown(s => s + STEP)) : null}
                  {result.canMore ? chip(searchingMore ? 'Searching…' : 'Search for more', false, () => { if (!searchingMore) void searchMore(); }) : null}
                  {looserCount > 0 ? chip(looser ? 'Hide looser matches' : `Show looser matches (${looserCount})`, looser, () => { const on = !looser; setLooser(on); setShown(on ? notRemoved.length : STEP); }) : null}
                </View>
                {result.canMore ? <Text style={small}>“Search for more” uses part of the app’s daily video searches.</Text> : null}
              </View>
            ) : null}
          </>
        ) : null}

        {view === 'favourites' ? (favourites.length === 0
          ? <Text style={small}>{canMark ? 'No favourites for this book yet. Tap the star on a video to keep it here.' : 'Favourites are not available yet.'}</Text>
          : favourites.map(m => card({ id: m.videoId, title: m.title || 'Video', channel: m.channel, publishedAt: m.publishedAt }, 'favourite'))) : null}

        {view === 'hidden' ? (removed.length === 0
          ? <Text style={small}>Nothing removed. A video you remove from the results waits here, and can be brought back.</Text>
          : removed.map(m => card({ id: m.videoId, title: m.title || 'Video', channel: m.channel, publishedAt: m.publishedAt }, 'removed'))) : null}

        {result && (result.status === 'unreachable' || result.status === 'unavailable')
          ? chip('Try again', false, () => { setAnswer(null); setAgain(n => n + 1); }) : null}
        <Pressable onPress={() => void Linking.openURL(youtubeSearchUrl(book, topic))} accessibilityLabel="Search on YouTube">
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radii.pill, backgroundColor: P.accent, borderWidth: 1, borderColor: P.accentBorder }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.accentInk }}>Search on YouTube</Text>
            <ExternalLink size={14} color={P.accentInk} />
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
