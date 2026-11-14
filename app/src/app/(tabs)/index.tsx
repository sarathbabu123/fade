import { applyMove, board, createRound, DEFAULT_ROUND_CONFIG, nextToFade } from '@fade/engine';
import { useQuery } from '@tanstack/react-query';
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
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, type } from '@/theme';

// Built with the real engine: X holds 0, 4, 5 with 0 next to fade; O holds 2, 6.
// (Phase 2 swaps this for a live bot-vs-bot demo.)
const heroRound = [0, 2, 4, 6, 5].reduce((s, c) => applyMove(s, c), createRound(DEFAULT_ROUND_CONFIG, 'X'));
const HERO: Cell[] = board(heroRound);
const HERO_FADING = [nextToFade(heroRound, 'X')].filter((c): c is number => c !== null);


export default function PlayScreen() {
  const avatar = useSettings((s) => s.avatar);
  const username = useSettings((s) => s.username);
  const me = useSettings((s) => s.userId);
  const [sheet, setSheet] = useState<'tc' | 'bot' | null>(null);
  const tc = useSettings((s) => s.timeControl);
  const rated = useSettings((s) => (s.rated ? 'rated' : 'casual'));
  const botLevel = useSettings((s) => s.botLevel);
  const set = useSettings((s) => s.set);
  const setTc = (v: 'rapid' | 'blitz') => set({ timeControl: v });
  const setRated = (v: 'rated' | 'casual') => set({ rated: v === 'rated' });

  const ratingQuery = useQuery({
    queryKey: ['my-rating', me, tc],
    queryFn: async () => {
      if (!me) return null;
      const { data } = await supabase.from('ratings').select('*').eq('user_id', me).eq('time_control', tc).maybeSingle();
      return data;
    },
    enabled: !!me,
    refetchInterval: 15_000,
  });

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
            <RatingChip
              label={tc === 'rapid' ? 'Rapid' : 'Blitz'}
              rating={ratingQuery.data?.rating ?? 1200}
              provisional={(ratingQuery.data?.games ?? 0) < 10}
            />
          </View>
        </View>
        <MiniBoard cells={HERO} fading={HERO_FADING} size={112} />
      </GlassCard>

      <Pressable style={styles.tcPill} onPress={() => setSheet('tc')} accessibilityLabel="Change time control">
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
        onPress={() => router.push('/challenge')}
      />
      <GlowButton title="Enter a code" icon={<KeyIcon />} variant="glass" size="md" onPress={() => router.push('/join')} />
      <GlowButton
        title="Play the bot"
        subtitle="Easy, Medium, Hard, Impossible"
        icon={<BotIcon color={colors.onAccent} />}
        variant="cyan"
        onPress={() => setSheet('bot')}
      />
      <GlowButton
        title="Pass & Play"
        subtitle="Two players, one phone"
        icon={<PassIcon />}
        variant="glass"
        onPress={() => router.push({ pathname: '/match', params: { mode: 'pass', tc } })}
      />

      <BottomSheet visible={sheet === 'tc'} onClose={() => setSheet(null)} title="Time control">
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
        <GlowButton title="Done" variant="coral" size="md" onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'bot'} onClose={() => setSheet(null)} title="Play the bot">
        <Segmented
          value={botLevel}
          onChange={(v) => set({ botLevel: v })}
          accent={colors.o}
          options={[
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Med' },
            { value: 'hard', label: 'Hard' },
            { value: 'impossible', label: 'Max' },
          ]}
        />
        <Text style={[type.bodyDim, styles.center]}>
          {botLevel === 'impossible'
            ? 'Perfect play. When it moves first, it cannot lose.'
            : botLevel === 'hard'
              ? 'Near-perfect, slips about one move in ten.'
              : botLevel === 'medium'
                ? 'Takes every win, sometimes misses a block.'
                : 'Mostly random. Good for learning the fade.'}
        </Text>
        <Text style={[type.caption, styles.center]}>{tc === 'rapid' ? 'RAPID · 8 S A MOVE' : 'BLITZ · 3 S A MOVE'} · NOT RATED</Text>
        <GlowButton
          title="Start"
          variant="cyan"
          size="md"
          onPress={() => {
            setSheet(null);
            router.push({ pathname: '/match', params: { mode: 'bot', level: botLevel, tc } });
          }}
        />
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
  center: { textAlign: 'center' },
  tcChange: { ...type.caption, marginLeft: 'auto', color: colors.o },
});
