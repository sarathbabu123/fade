import { Canvas, DashPathEffect, Path, Skia } from '@shopify/react-native-skia';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Avatar } from '@/components/Avatar';
import { GlassCard } from '@/components/GlassCard';
import { GearIcon } from '@/components/Icons';
import { RatingChip } from '@/components/RatingChip';
import { Screen } from '@/components/Screen';
import { NeonSkeleton } from '@/components/NeonSkeleton';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, type, withAlpha } from '@/theme';

interface RatingRow {
  time_control: 'rapid' | 'blitz';
  rating: number;
  rd: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  streak: number;
  best_streak: number;
}

interface HistoryRow {
  time_control: 'rapid' | 'blitz';
  rating_after: number;
  created_at: string;
}

function EmptyGraph({ width }: { width: number }) {
  const h = 90;
  const path = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.moveTo(0, h * 0.7);
    p.cubicTo(width * 0.25, h * 0.75, width * 0.35, h * 0.35, width * 0.55, h * 0.45);
    p.cubicTo(width * 0.75, h * 0.55, width * 0.8, h * 0.2, width, h * 0.25);
    return p.detach();
  }, [width]);
  return (
    <Canvas style={{ width, height: h }}>
      <Path path={path} color={withAlpha(colors.gold, 0.35)} style="stroke" strokeWidth={2} strokeCap="round">
        <DashPathEffect intervals={[4, 7]} />
      </Path>
    </Canvas>
  );
}

function RatingLineGraph({ points, width }: { points: number[]; width: number }) {
  const h = 90;
  const paddingY = 12;
  const path = useMemo(() => {
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = Math.max(1, max - min);
    const p = Skia.PathBuilder.Make();
    points.forEach((val, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = h - paddingY - ((val - min) / range) * (h - paddingY * 2);
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    });
    return p.detach();
  }, [points, width]);

  if (!path) return <EmptyGraph width={width} />;

  return (
    <Canvas style={{ width, height: h }}>
      <Path path={path} color={colors.gold} style="stroke" strokeWidth={3} strokeCap="round" strokeJoin="round" />
    </Canvas>
  );
}

export default function ProfileScreen() {
  const avatar = useSettings((s) => s.avatar);
  const username = useSettings((s) => s.username);
  const me = useSettings((s) => s.userId);
  const { width } = useWindowDimensions();
  const [selectedTc, setSelectedTc] = useState<'rapid' | 'blitz'>('rapid');

  const ratingsQuery = useQuery({
    queryKey: ['my-ratings', me],
    queryFn: async (): Promise<RatingRow[]> => {
      if (!me) return [];
      const { data, error } = await supabase.from('ratings').select('*').eq('user_id', me);
      if (error) throw error;
      return (data ?? []) as RatingRow[];
    },
    enabled: !!me,
    refetchInterval: 15_000,
  });

  const historyQuery = useQuery({
    queryKey: ['my-rating-history', me, selectedTc],
    queryFn: async (): Promise<HistoryRow[]> => {
      if (!me) return [];
      const { data, error } = await supabase
        .from('rating_history')
        .select('time_control, rating_after, created_at')
        .eq('user_id', me)
        .eq('time_control', selectedTc)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
    enabled: !!me,
    refetchInterval: 15_000,
  });

  const rapid = ratingsQuery.data?.find((r) => r.time_control === 'rapid');
  const blitz = ratingsQuery.data?.find((r) => r.time_control === 'blitz');

  const graphPoints = useMemo(() => {
    const list = historyQuery.data ?? [];
    if (list.length === 0) return [];
    return [1200, ...list.map((h) => h.rating_after)];
  }, [historyQuery.data]);

  const totalWins = (rapid?.wins ?? 0) + (blitz?.wins ?? 0);
  const totalDraws = (rapid?.draws ?? 0) + (blitz?.draws ?? 0);
  const totalLosses = (rapid?.losses ?? 0) + (blitz?.losses ?? 0);
  const bestStreak = Math.max(rapid?.best_streak ?? 0, blitz?.best_streak ?? 0);

  const stats = [
    { label: 'WINS', value: totalWins, color: colors.gold },
    { label: 'DRAWS', value: totalDraws, color: colors.text },
    { label: 'LOSSES', value: totalLosses, color: colors.textDim },
    { label: 'BEST STREAK', value: bestStreak, color: colors.x },
  ];

  return (
    <Screen tabs>
      <View style={styles.top}>
        <Text style={type.title}>Profile</Text>
        <Pressable onPress={() => router.push('/settings')} accessibilityLabel="Settings" hitSlop={10}>
          <GearIcon color={colors.textDim} />
        </Pressable>
      </View>

      <View style={styles.identity}>
        <Avatar avatar={avatar} size={84} ring={1} ringColor={colors.gold} />
        <View style={styles.identityText}>
          <Text style={type.title} numberOfLines={1}>
            {username ?? 'Player'}
          </Text>
          <Text style={type.bodyDim}>Guest account · on this phone</Text>
        </View>
      </View>

      <View style={styles.ratings}>
        <Pressable style={styles.flex} onPress={() => setSelectedTc('rapid')}>
          <RatingChip
            label="Rapid"
            rating={rapid?.rating ?? 1200}
            provisional={(rapid?.games ?? 0) < 10}
            active={selectedTc === 'rapid'}
          />
        </Pressable>
        <Pressable style={styles.flex} onPress={() => setSelectedTc('blitz')}>
          <RatingChip
            label="Blitz"
            rating={blitz?.rating ?? 1200}
            provisional={(blitz?.games ?? 0) < 10}
            active={selectedTc === 'blitz'}
          />
        </Pressable>
      </View>

      <GlassCard style={styles.graphCard}>
        <View style={styles.graphHeader}>
          <Text style={type.caption}>{selectedTc.toUpperCase()} RATING</Text>
          {graphPoints.length >= 2 && (
            <Text style={[type.label, { color: colors.gold }]}>
              {graphPoints[graphPoints.length - 1]}
            </Text>
          )}
        </View>
        <RatingLineGraph points={graphPoints} width={width - spacing.xl * 2 - spacing.lg * 2} />
        <Text style={type.bodyDim}>
          {graphPoints.length >= 2
            ? `${graphPoints.length - 1} rated game(s) recorded`
            : 'Your graph starts after your first rated match.'}
        </Text>
      </GlassCard>

      <View style={styles.stats}>
        {ratingsQuery.isLoading && !ratingsQuery.data ? (
          [1, 2, 3, 4].map((i) => (
            <GlassCard key={i} style={styles.stat}>
              <NeonSkeleton width={60} height={28} />
              <NeonSkeleton width={50} height={12} />
            </GlassCard>
          ))
        ) : (
          stats.map((s) => (
            <GlassCard key={s.label} style={styles.stat}>
              <AnimatedNumber value={s.value} style={{ ...type.number, color: s.color }} />
              <Text style={type.caption}>{s.label}</Text>
            </GlassCard>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  identityText: { flex: 1, gap: spacing.xs },
  ratings: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  graphCard: { gap: spacing.sm },
  graphHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexBasis: '47%', flexGrow: 1, gap: spacing.xs },
});
