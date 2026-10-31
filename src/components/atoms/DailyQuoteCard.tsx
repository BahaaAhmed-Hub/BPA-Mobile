import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Quote as QuoteIcon, RefreshCw } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii, Shadows } from '../../theme/tokens';
import { useLibraryStore } from '../../store/libraryStore';
import { useModuleStore } from '../../store/moduleStore';
import { moduleIsOff } from '../../lib/entitlements';
import { hasWords, quoteOfTheDay } from '../../lib/library';
import type { RootStackParamList } from '../../navigation/RootNavigator';

/** A line you saved, on Today. Draws nothing unless there is something to show: the Library off (the plan or the
 *  person's switch), the person said no to this alone, or no quote with words. No empty card and no nag. */
export function DailyQuoteCard() {
  const P = useScreenPalette();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const modules = useModuleStore(s => s.modules);
  const loadModules = useModuleStore(s => s.load);
  const { books, quotes, settings, loaded, unavailable, loadFromDB } = useLibraryStore();
  const [shift, setShift] = useState(0);

  useEffect(() => { void loadModules(); }, [loadModules]);
  useEffect(() => { if (!loaded && !moduleIsOff(modules, 'library')) void loadFromDB(); }, [loaded, modules, loadFromDB]);

  const today = new Date().toLocaleDateString('en-CA');
  const quote = useMemo(() => quoteOfTheDay(quotes, today, shift), [quotes, today, shift]);
  const pool = useMemo(() => quotes.filter(hasWords).length, [quotes]);
  if (moduleIsOff(modules, 'library') || !settings.enabled || !settings.dailyQuote || unavailable || !quote) return null;

  const book = books.find(b => b.id === quote.book_id);
  return (
    <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, padding: 16, gap: 10, ...Shadows.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <QuoteIcon size={14} color={P.accentDeep} />
        <Text style={{ flex: 1, fontFamily: UIFont.semiBold, fontSize: 11, letterSpacing: 1.4, color: P.ink4 }}>QUOTE OF THE DAY</Text>
        {pool > 1 ? (
          <Pressable onPress={() => setShift(s => s + 1)} accessibilityLabel="Another quote" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
            <RefreshCw size={12} color={P.ink3} />
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink3 }}>Another</Text>
          </Pressable>
        ) : null}
      </View>
      <Text selectable style={{ fontFamily: NumFont.medium, fontSize: 17, lineHeight: 25, color: P.ink }}>{quote.body?.trim()}</Text>
      {book ? (
        <Pressable onPress={() => navigation.navigate('LibraryBook', { bookId: book.id })} accessibilityLabel={`Open ${book.title}`}>
          <Text numberOfLines={2} style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.ink3 }}>
            {book.title}{book.authors.length ? ` · ${book.authors.join(', ')}` : ''}{quote.page ? ` · p. ${quote.page}` : ''}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
