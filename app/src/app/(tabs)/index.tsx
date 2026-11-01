import { applyMove, board, createRound, DEFAULT_ROUND_CONFIG, nextToFade } from '@fade/engine';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { GlassCard } from '@/components/GlassCard';
import { GlowButton } from '@/components/GlowButton';
import { BotIcon, KeyIcon, PassIcon, SwordsIcon } from '@/components/Icons';
import { MiniBoard } from '@/components/MiniBoard';
import type { Cell } from '@/components/MiniBoard';
import { Segmented } from '@/components/NeonSwitch';
import { RatingChip } from '@/components/RatingChip';
import { Screen } from '@/components/Screen';
import { Wordmark } from '@/components/Wordmark';
import { useSettings } from '@/lib/settings';
import { colors, radii, spacing, type } from '@/theme';

// Built with the real engine: X holds 0, 4, 5 with 0 next to fade; O holds 2, 6.
// (Phase 2 swaps this for a live bot-vs-bot demo.)
const heroRound = [0, 2, 4, 6, 5].reduce((s, c) => applyMove(s, c), createRound(DEFAULT_ROUND_CONFIG, 'X'));
const HERO: Cell[] = board(heroRound);
const HERO_FADING = [nextToFade(heroRound, 'X')].filter((c): c is number => c !== null);

type TimeControl = 'rapid' | 'blitz';

export default function PlayScreen() {
  const avatar = useSettings((s) => s.avatar);
  const username = useSettings((s) => s.username);
  const [sheet, setSheet] = useState(false);
  const [tc, setTc] = useState<TimeControl>('rapid');
  const [rated, setRated] = useState<'rated' | 'casual'>('rated');

  return (
    <Screen tabs>
      <View style={styles.header}>
        <Wordmark size={30} />
        <Pressable onPress={() => router.push('/profile')} accessibilityLabel="Your profile" hitSlop={8}>
          <Avatar avatar={avatar} size={40} />
        </Pressable>
      </View>

      <GlassCard style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={type.caption}>HEY {username?.toUpperCase() ?? 'PLAYER'}</Text>
          <Text style={[type.heading, styles.tagline]}>Your oldest mark fades.{'\n'}Three in a row wins.</Text>
          <View style={styles.chips}>
            <RatingChip label="Rapid" rating={1200} provisional />
          </View>
        </View>
        <MiniBoard cells={HERO} fading={HERO_FADING} size={112} />
      </GlassCard>

      <Pressable style={styles.tcPill} onPress={() => setSheet(true)} accessibilityLabel="Change time control">
        <View style={[styles.dot, { backgroundColor: tc === 'rapid' ? colors.o : colors.x }]} />
        <Text style={type.label}>
          {tc === 'rapid' ? 'Rapid · 8 s' : 'Blitz · 3 s'}
          <Text style={styles.tcDim}>  ·  {rated === 'rated' ? 'Rated' : 'Casual'}</Text>
        </Text>
        <Text style={styles.tcChange}>Change</Text>
      </Pressable>

      <GlowButton
        title="Challenge a friend"
        subtitle="Send a code on WhatsApp"
        icon={<SwordsIcon color={colors.onAccent} />}
        variant="coral"
      />
      <GlowButton title="Enter a code" icon={<KeyIcon />} variant="glass" size="md" />
      <GlowButton
        title="Play the bot"
        subtitle="Easy, Medium, Hard, Impossible"
        icon={<BotIcon color={colors.onAccent} />}
        variant="cyan"
      />
      <GlowButton title="Pass & Play" subtitle="Two players, one phone" icon={<PassIcon />} variant="glass" />

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Time control">
        <Segmented
          value={tc}
          onChange={setTc}
          accent={colors.o}
          options={[
            { value: 'rapid', label: 'Rapid', hint: '8 S A MOVE' },
            { value: 'blitz', label: 'Blitz', hint: '3 S A MOVE' },
          ]}
        />
        <Segmented
          value={rated}
          onChange={setRated}
          accent={colors.gold}
          options={[
            { value: 'rated', label: 'Rated', hint: 'COUNTS' },
            { value: 'casual', label: 'Casual', hint: 'JUST FOR FUN' },
          ]}
        />
        <GlowButton title="Done" variant="coral" size="md" onPress={() => setSheet(false)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroText: { flex: 1, gap: spacing.sm },
  tagline: { lineHeight: 24 },
  chips: { flexDirection: 'row', marginTop: spacing.xs },
  tcPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tcDim: { color: colors.textDim, fontFamily: type.body.fontFamily },
  tcChange: { ...type.caption, marginLeft: 'auto', color: colors.o },
});
