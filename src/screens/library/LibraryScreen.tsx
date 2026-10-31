import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import { Pressable } from '../../components/atoms/Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii, Shadows } from '../../theme/tokens';
import { useLibraryStore } from '../../store/libraryStore';
import { STATUS_LABEL, hasWords, type Book } from '../../lib/library';
import { drawableColor } from '../../lib/projects';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function Cover({ book, size }: { book: Pick<Book, 'cover_url' | 'spine_color' | 'title'>; size: number }) {
  const P = useScreenPalette();
  const [failed, setFailed] = useState(false);
  const w = Math.round(size * 0.68);
  if (book.cover_url && !failed) {
    return <Image source={{ uri: book.cover_url }} onError={() => setFailed(true)} accessibilityIgnoresInvertColors style={{ width: w, height: size, borderRadius: 6, backgroundColor: P.field }} resizeMode="cover" />;
  }
  // No cover: the book's own spine colour with its first letter, so the row still reads as a book.
  return (
    <View style={{ width: w, height: size, borderRadius: 6, backgroundColor: drawableColor(book.spine_color, P.accentTint), alignItems: 'center', justifyContent: 'center', padding: 4 }}>
      <Text style={{ fontFamily: NumFont.bold, fontSize: size * 0.32, color: P.ink }}>{book.title.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function Stars({ rating }: { rating: number }) {
  const P = useScreenPalette();
  if (!(rating > 0)) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessible accessibilityLabel={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => <Star key={n} size={12} color={n <= rating ? P.accentDeep : P.hairline} fill={n <= rating ? P.accentDeep : 'transparent'} />)}
    </View>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  const P = useScreenPalette();
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable onPress={onBack} accessibilityLabel="Back"
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline }}>
        <ChevronLeft size={22} color={P.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.4 }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

type Filter = 'reading' | 'want' | 'finished' | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'reading', label: 'Reading' }, { id: 'want', label: 'Want to read' }, { id: 'finished', label: 'Finished' }, { id: 'all', label: 'All' },
];

export function LibraryScreen() {
  const navigation = useNavigation<Nav>();
  const P = useScreenPalette();
  const { books, quotes, loading, loaded, unavailable, settings, loadFromDB } = useLibraryStore();
  const [filter, setFilter] = useState<Filter | null>(null);

  useEffect(() => { void loadFromDB(); }, [loadFromDB]);

  // Open on what you are reading, or on everything if nothing is.
  const active: Filter = filter ?? (books.some(b => b.status === 'reading') ? 'reading' : 'all');
  const shown = useMemo(() => books.filter(b => active === 'all' ? true : b.status === active), [books, active]);
  const quoteCount = (id: string) => quotes.filter(q => q.book_id === id && hasWords(q)).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <Header title="Library" subtitle={`${books.length} book${books.length === 1 ? '' : 's'} · ${quotes.filter(hasWords).length} quotes · manage on the web`} onBack={() => navigation.goBack()} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
        {FILTERS.map(f => {
          const on = active === f.id;
          const n = f.id === 'all' ? books.length : books.filter(b => b.status === f.id).length;
          return (
            <Pressable key={f.id} onPress={() => setFilter(f.id)} accessibilityState={{ selected: on }}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radii.pill, backgroundColor: on ? P.accent : P.surface, borderWidth: 1, borderColor: on ? P.accentBorder : P.hairline }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: on ? P.accentInk : P.ink2 }}>{f.label} · {n}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {!loaded && loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={P.ink3} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={b => b.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 10, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadFromDB()} tintColor={P.accent} />}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 16, color: P.ink }}>
                {!settings.enabled ? 'The Library is off' : unavailable ? 'The Library is not set up yet' : books.length === 0 ? 'No books yet' : 'No books here'}
              </Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 13, lineHeight: 19, color: P.ink3, textAlign: 'center' }}>
                {!settings.enabled ? 'You switched it off in Settings on the web.' : unavailable ? "This database doesn't have the library tables." : 'Books you add on the web appear here.'}
              </Text>
            </View>
          }
          renderItem={({ item: b }) => {
            const n = quoteCount(b.id);
            return (
              <Pressable onPress={() => navigation.navigate('LibraryBook', { bookId: b.id })} accessibilityLabel={`${b.title}${b.authors.length ? ` by ${b.authors.join(', ')}` : ''}`}>
                <View style={{ flexDirection: 'row', gap: 12, backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, padding: 12, ...Shadows.card }}>
                  <Cover book={b} size={86} />
                  <View style={{ flex: 1, gap: 3, justifyContent: 'center' }}>
                    <Text numberOfLines={2} style={{ fontFamily: NumFont.bold, fontSize: 16, color: P.ink, letterSpacing: -0.2 }}>{b.title}</Text>
                    {b.authors.length ? <Text numberOfLines={1} style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.ink3 }}>{b.authors.join(', ')}</Text> : null}
                    <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink2 }}>
                      {STATUS_LABEL[b.status]}{b.pages ? ` · ${b.pages} pages` : ''}{n ? ` · ${n} quote${n === 1 ? '' : 's'}` : ''}
                    </Text>
                    <Stars rating={b.rating} />
                  </View>
                  <View style={{ justifyContent: 'center' }}><ChevronRight size={16} color={P.ink4} /></View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

export function LibraryBookScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'LibraryBook'>>();
  const P = useScreenPalette();
  const book = useLibraryStore(s => s.books.find(b => b.id === params.bookId));
  const quotes = useLibraryStore(s => s.quotes);
  const mine = useMemo(() => quotes.filter(q => q.book_id === params.bookId && hasWords(q)), [quotes, params.bookId]);

  if (!book) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
        <Header title="Book" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 16, color: P.ink }}>This book is no longer here</Text>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <Header title="Book" subtitle="manage on the web" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80, gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Cover book={book} size={150} />
          <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
            <Text style={{ fontFamily: NumFont.bold, fontSize: 22, color: P.ink, letterSpacing: -0.4 }}>{book.title}</Text>
            {book.subtitle ? <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink2 }}>{book.subtitle}</Text> : null}
            {book.authors.length ? <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink3 }}>{book.authors.join(', ')}</Text> : null}
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink2, marginTop: 4 }}>
              {STATUS_LABEL[book.status]}{book.pages ? ` · ${book.pages} pages` : ''}
            </Text>
            <Stars rating={book.rating} />
          </View>
        </View>

        {book.review ? (
          <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, padding: 14, gap: 6 }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, letterSpacing: 1.4, color: P.ink4 }}>YOUR REVIEW</Text>
            <Text selectable style={{ fontFamily: UIFont.regular, fontSize: 14, lineHeight: 21, color: P.ink }}>{book.review}</Text>
          </View>
        ) : null}

        {book.description ? (
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, letterSpacing: 1.4, color: P.ink4 }}>ABOUT</Text>
            <Text selectable numberOfLines={12} style={{ fontFamily: UIFont.regular, fontSize: 14, lineHeight: 21, color: P.ink2 }}>{book.description}</Text>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, letterSpacing: 1.4, color: P.ink4 }}>QUOTES · {mine.length}</Text>
          {mine.length === 0 ? (
            <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3 }}>No quotes saved from this book.</Text>
          ) : mine.map(q => (
            <View key={q.id} style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, padding: 14, gap: 6 }}>
              <Text selectable style={{ fontFamily: NumFont.medium, fontSize: 15, lineHeight: 22, color: P.ink }}>{q.body?.trim()}</Text>
              {q.page ? <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>Page {q.page}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
