import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { GlassCard } from '@/components/GlassCard';
import { glyphNames } from '@/components/glyphs';
import { GlowButton } from '@/components/GlowButton';
import { MiniBoard } from '@/components/MiniBoard';
import type { Cell } from '@/components/MiniBoard';
import { Wordmark } from '@/components/Wordmark';
import { saveProfile } from '@/lib/account';
import { useReduceMotion } from '@/lib/motion';
import { haptic, USERNAME_RE, useSettings } from '@/lib/settings';
import type { AvatarId } from '@/lib/settings';
import { avatarColors, colors, glow, radii, spacing, type, withAlpha } from '@/theme';
import type { AvatarColor } from '@/theme';

const WIN: Cell[] = ['X', 'O', null, null, 'X', 'O', null, null, 'X'];
const FADE: Cell[] = ['X', 'O', null, null, 'X', 'X', 'O', null, null];

/** Clock ring that depletes and turns amber, then red, on loop. */
function ClockDemo() {
  const reduce = useReduceMotion();
  const p = useSharedValue(1);
  useEffect(() => {
    if (reduce) {
      p.value = 0.6;
      return;
    }
    p.value = withRepeat(withTiming(0, { duration: 4000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(p);
  }, [reduce, p]);
  const color = useDerivedValue(() =>
    interpolateColor(p.value, [0, 0.0625, 0.125, 0.2, 1], [colors.alarm, colors.alarm, colors.amber, colors.x, colors.x]),
  );
  return <Avatar avatar={{ glyph: 'bolt', color: 'coral' }} size={96} ring={p} ringColor={color} />;
}

const CARDS = [
  {
    title: 'Three in a row wins.',
    body: 'Rows, columns or diagonals. Just like the game you know…',
    art: <MiniBoard cells={WIN} line={[0, 4, 8]} size={180} />,
  },
  {
    title: 'You only get three.',
    body: 'Place a fourth and your oldest mark fades. The pulsing one goes next. Plan for it.',
    art: <MiniBoard cells={FADE} fading={[0]} size={180} />,
  },
  {
    title: 'Beat the shot clock.',
    body: '8 seconds a move. Run out and your oldest mark fades anyway. Three timeouts in a row lose the round.',
    art: <ClockDemo />,
  },
];

function Dot({ i, x, w }: { i: number; x: SharedValue<number>; w: number }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(x.value / w - i);
    return {
      width: interpolate(d, [0, 1], [22, 7], 'clamp'),
      opacity: interpolate(d, [0, 1], [1, 0.35], 'clamp'),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

function ProfileSetup({ onDone, error, busy }: { onDone: (name: string, avatar: AvatarId) => void; error: string | null; busy: boolean }) {
  const saved = useSettings();
  const [name, setName] = useState(saved.username ?? '');
  const [avatar, setAvatar] = useState<AvatarId>(saved.avatar);
  const valid = USERNAME_RE.test(name);
  return (
    <View style={styles.setup}>
      <View style={styles.preview}>
        <Avatar avatar={avatar} size={88} />
      </View>
      <TextInput
        value={name}
        onChangeText={(t) => setName(t.replace(/\s/g, ''))}
        placeholder="Pick a username"
        placeholderTextColor={colors.textFaint}
        maxLength={16}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, valid && styles.inputValid]}
        accessibilityLabel="Username"
      />
      <Text style={[type.caption, styles.center]}>3–16 LETTERS, NUMBERS OR _</Text>

      <View style={styles.grid}>
        {glyphNames.map((g) => (
          <Pressable
            key={g}
            onPress={() => {
              haptic.selection();
              setAvatar((a) => ({ ...a, glyph: g }));
            }}
            accessibilityLabel={`Glyph ${g}`}
            style={[styles.glyphCell, avatar.glyph === g && styles.glyphOn]}>
            <Avatar avatar={{ glyph: g, color: avatar.color }} size={40} />
          </Pressable>
        ))}
      </View>
      <View style={styles.colorRow}>
        {(Object.keys(avatarColors) as AvatarColor[]).map((c) => (
          <Pressable
            key={c}
            onPress={() => {
              haptic.selection();
              setAvatar((a) => ({ ...a, color: c }));
            }}
            accessibilityLabel={`Colour ${c}`}
            style={[
              styles.swatch,
              { backgroundColor: avatarColors[c] },
              avatar.color === c && { boxShadow: glow(avatarColors[c], 12, 0.8), transform: [{ scale: 1.15 }] },
            ]}
          />
        ))}
      </View>
      {error ? <Text style={[type.label, styles.center, { color: colors.coral }]}>{error}</Text> : null}
      <GlowButton title={busy ? 'Saving…' : "Let's play"} variant="coral" disabled={!valid || busy} onPress={() => onDone(name, avatar)} />
    </View>
  );
}

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const set = useSettings((s) => s.set);
  const x = useSharedValue(0);
  const scroller = useRef<Animated.ScrollView>(null);
  const [page, setPage] = useState(edit ? CARDS.length : 0);
  const pages = CARDS.length + 1;

  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async (username: string, avatar: AvatarId) => {
    setBusy(true);
    setSaveError(null);
    set({ username, avatar, profileSynced: false });
    // Claim the name online now if we can; offline is fine, it syncs later.
    const r = await saveProfile();
    setBusy(false);
    if (!r.ok && r.reason === 'taken') {
      setSaveError(r.message);
      haptic.medium();
      return;
    }
    haptic.success();
    set({ onboarded: true });
    if (edit) router.back();
    else router.replace('/');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.brand}>
        <Wordmark size={26} />
        {page < CARDS.length && (
          <Pressable onPress={() => scroller.current?.scrollTo({ x: width * CARDS.length })} hitSlop={10}>
            <Text style={[type.label, styles.skip]}>Skip</Text>
          </Pressable>
        )}
      </View>
      <Animated.ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentOffset={{ x: edit ? width * CARDS.length : 0, y: 0 }}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {CARDS.map((c) => (
          <View key={c.title} style={[styles.page, { width }]}>
            <GlassCard style={styles.card}>
              <View style={styles.art}>{c.art}</View>
              <Text style={[type.title, styles.center]}>{c.title}</Text>
              <Text style={[type.bodyDim, styles.center]}>{c.body}</Text>
            </GlassCard>
          </View>
        ))}
        <View style={[styles.page, { width }]}>
          <ProfileSetup onDone={(n, a) => void finish(n, a)} error={saveError} busy={busy} />
        </View>
      </Animated.ScrollView>
      <View style={styles.dots}>
        {Array.from({ length: pages }, (_, i) => (
          <Dot key={i} i={i} x={x} w={width} />
        ))}
      </View>
      {page < CARDS.length && (
        <View style={styles.next}>
          <GlowButton
            title="Next"
            variant="glass"
            size="md"
            onPress={() => scroller.current?.scrollTo({ x: width * (page + 1) })}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl },
  skip: { color: colors.textDim },
  page: { paddingHorizontal: spacing.xl, justifyContent: 'center' },
  card: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  art: { height: 190, justifyContent: 'center', marginBottom: spacing.sm },
  center: { textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { height: 7, borderRadius: 4, backgroundColor: colors.text },
  next: { paddingHorizontal: spacing.xl },
  setup: { gap: spacing.md },
  preview: { alignItems: 'center', marginBottom: spacing.xs },
  input: {
    ...type.heading,
    textAlign: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.glass,
  },
  inputValid: { borderColor: withAlpha(colors.o, 0.7) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  glyphCell: { borderRadius: radii.md, padding: 2, borderWidth: 1, borderColor: colors.transparent },
  glyphOn: { borderColor: colors.hairlineBright, backgroundColor: colors.glass },
  colorRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginVertical: spacing.xs },
  swatch: { width: 26, height: 26, borderRadius: 13 },
});
