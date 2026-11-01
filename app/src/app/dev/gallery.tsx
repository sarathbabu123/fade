import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  interpolateColor,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { GlassCard } from '@/components/GlassCard';
import { glyphNames } from '@/components/glyphs';
import { GlowButton } from '@/components/GlowButton';
import { BotIcon, SwordsIcon } from '@/components/Icons';
import { MiniBoard } from '@/components/MiniBoard';
import { NeonSwitch, Segmented } from '@/components/NeonSwitch';
import { RatingChip } from '@/components/RatingChip';
import { Screen } from '@/components/Screen';
import { Wordmark } from '@/components/Wordmark';
import { avatarColors, colors, spacing, type } from '@/theme';
import type { AvatarColor } from '@/theme';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={type.caption}>{title}</Text>
      {children}
    </View>
  );
}

/** Ring that depletes over 8 s: player colour → amber (≤1 s) → red (≤0.5 s). */
function ClockRing() {
  const p = useSharedValue(1);
  useEffect(() => {
    p.value = withRepeat(withTiming(0, { duration: 8000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(p);
  }, [p]);
  const color = useDerivedValue(() =>
    interpolateColor(p.value, [0, 0.0625, 0.0626, 0.125, 0.1251, 1], [colors.alarm, colors.alarm, colors.amber, colors.amber, colors.o, colors.o]),
  );
  return <Avatar avatar={{ glyph: 'moon', color: 'cyan' }} size={64} ring={p} ringColor={color} />;
}

export default function Gallery() {
  const [sheet, setSheet] = useState(false);
  const [n, setN] = useState(1200);
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b'>('a');
  const colorNames = Object.keys(avatarColors) as AvatarColor[];

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Text style={[type.label, { color: colors.textDim }]}>‹ Back</Text>
      </Pressable>
      <Text style={type.title}>Gallery</Text>

      <Section title="WORDMARK">
        <Wordmark size={44} />
      </Section>

      <Section title="GLOW BUTTONS">
        <GlowButton title="Challenge a friend" subtitle="Send a code" icon={<SwordsIcon color={colors.onAccent} />} />
        <GlowButton title="Play the bot" icon={<BotIcon color={colors.onAccent} />} variant="cyan" />
        <GlowButton title="Gold" variant="gold" size="md" />
        <GlowButton title="Glass" variant="glass" size="md" />
        <View style={styles.row}>
          <GlowButton title="Small" size="sm" />
          <GlowButton title="Glass" size="sm" variant="glass" />
          <GlowButton title="Off" size="sm" disabled />
        </View>
      </Section>

      <Section title="GLASS CARD">
        <GlassCard>
          <Text style={type.body}>Plain glass card</Text>
        </GlassCard>
        <GlassCard glowColor={colors.o}>
          <Text style={type.body}>With cyan glow</Text>
        </GlassCard>
      </Section>

      <Section title="AVATARS (12 GLYPHS × 8 COLOURS)">
        <View style={styles.wrap}>
          {glyphNames.map((g, i) => (
            <Avatar key={g} avatar={{ glyph: g, color: colorNames[i % colorNames.length]! }} size={48} />
          ))}
        </View>
        <View style={styles.row}>
          <ClockRing />
          <Avatar avatar={{ glyph: 'crown', color: 'gold' }} size={64} ring={1} ringColor={colors.x} />
          <Avatar avatar={{ glyph: 'ghost', color: 'violet' }} size={64} dimmed />
        </View>
      </Section>

      <Section title="RATING CHIP + ODOMETER">
        <View style={styles.row}>
          <RatingChip label="Rapid" rating={n} provisional />
          <RatingChip label="Blitz" rating={1438} delta={14} />
          <RatingChip label="Rapid" rating={1391} delta={-9} />
        </View>
        <View style={styles.row}>
          <AnimatedNumber value={n} style={{ ...type.number, fontSize: 40 }} />
          <GlowButton title="Roll" size="sm" variant="glass" onPress={() => setN(1000 + Math.floor(Math.random() * 900))} />
        </View>
      </Section>

      <Section title="MINI BOARD">
        <View style={styles.row}>
          <MiniBoard cells={['X', 'O', null, null, 'X', 'O', null, null, 'X']} line={[0, 4, 8]} size={120} />
          <MiniBoard cells={['X', 'O', null, null, 'X', 'X', 'O', null, 'O']} fading={[0, 1]} size={120} />
        </View>
      </Section>

      <Section title="CONTROLS">
        <View style={styles.row}>
          <NeonSwitch label="Demo" value={on} onChange={setOn} />
          <NeonSwitch label="Demo gold" value={!on} onChange={(v) => setOn(!v)} accent={colors.gold} />
        </View>
        <Segmented
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'a', label: 'Rapid', hint: '8 S' },
            { value: 'b', label: 'Blitz', hint: '3 S' },
          ]}
        />
        <GlowButton title="Open bottom sheet" variant="glass" size="md" onPress={() => setSheet(true)} />
      </Section>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Bottom sheet">
        <Text style={[type.bodyDim, { textAlign: 'center' }]}>Drag down or tap outside to close.</Text>
        <GlowButton title="Close" size="md" onPress={() => setSheet(false)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
