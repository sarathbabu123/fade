import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { GlassCard } from '@/components/GlassCard';
import type { GlyphName } from '@/components/glyphs';
import { GlowButton } from '@/components/GlowButton';
import { CrownIcon, KeyIcon, SwordsIcon } from '@/components/Icons';
import { Segmented } from '@/components/NeonSwitch';
import { RatingChip } from '@/components/RatingChip';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';
import { FriendSkeletonRow } from '@/components/NeonSkeleton';
import { colors, radii, spacing, type, withAlpha } from '@/theme';
import type { AvatarColor } from '@/theme';

interface Friend {
  id: string;
  username: string;
  avatar_glyph: string;
  avatar_color: string;
  last_seen_at: string;
  rating?: number;
  games?: number;
}

/** Seen in the last 2 minutes (the app heartbeats every minute while open). */
const ONLINE_MS = 2 * 60 * 1000;

function lastSeen(iso: string): { online: boolean; label: string } {
  const ago = Date.now() - Date.parse(iso);
  if (ago < ONLINE_MS) return { online: true, label: 'Online' };
  const m = Math.round(ago / 60000);
  if (m < 60) return { online: false, label: `Seen ${m} min ago` };
  const h = Math.round(m / 60);
  if (h < 24) return { online: false, label: `Seen ${h} h ago` };
  return { online: false, label: `Seen ${Math.round(h / 24)} d ago` };
}

async function fetchFriends(me: string, tc: 'rapid' | 'blitz'): Promise<Friend[]> {
  const { data: links, error } = await supabase.from('friendships').select('user_a, user_b');
  if (error) throw error;
  const ids = (links ?? []).map((l) => (l.user_a === me ? l.user_b : l.user_a));
  const allIds = Array.from(new Set([...ids, me]));
  if (!allIds.length) return [];
  const { data: profiles, error: e2 } = await supabase
    .from('profiles')
    .select('id, username, avatar_glyph, avatar_color, last_seen_at')
    .in('id', allIds);
  if (e2) throw e2;

  const { data: ratings } = await supabase
    .from('ratings')
    .select('user_id, rating, games')
    .in('user_id', allIds)
    .eq('time_control', tc);

  const ratingMap = new Map((ratings ?? []).map((r) => [r.user_id, { rating: r.rating, games: r.games }]));

  return (profiles as Friend[]).map((p) => {
    const r = ratingMap.get(p.id);
    return {
      ...p,
      rating: r?.rating ?? 1200,
      games: r?.games ?? 0,
    };
  });
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const me = useSettings((s) => s.userId);
  const tc = useSettings((s) => s.timeControl);
  const [tab, setTab] = useState<'friends' | 'leaderboard'>('friends');

  const friends = useQuery({
    queryKey: ['friends-with-ratings', me, tc],
    queryFn: () => fetchFriends(me!, tc),
    enabled: !!me,
    refetchInterval: 30_000,
  });

  const list = friends.data ?? [];
  const friendOnly = list.filter((f) => f.id !== me).sort((a, b) => Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at));
  const leaderboard = [...list].sort((a, b) => (b.rating ?? 1200) - (a.rating ?? 1200));

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl + TAB_BAR_SPACE }]}
      refreshControl={<RefreshControl refreshing={friends.isRefetching} onRefresh={() => void friends.refetch()} tintColor={colors.o} />}>
      <Text style={type.title}>Friends & Ratings</Text>

      <GlassCard glowColor={colors.x} style={styles.invite}>
        <Text style={type.heading}>Play someone you know</Text>
        <Text style={type.bodyDim}>Create a 6-letter code and send it on WhatsApp with the app link. They type it in, you play.</Text>
        <GlowButton title="Create challenge" icon={<SwordsIcon color={colors.onAccent} />} variant="coral" size="md" onPress={() => router.push('/challenge')} />
        <GlowButton title="I have a code" icon={<KeyIcon />} variant="glass" size="md" onPress={() => router.push('/join')} />
      </GlassCard>

      <Segmented
        value={tab}
        onChange={setTab}
        accent={colors.gold}
        options={[
          { value: 'friends', label: 'Friends' },
          { value: 'leaderboard', label: 'Leaderboard' },
        ]}
      />

      {tab === 'friends' ? (
        <>
          <Text style={type.caption}>YOUR FRIENDS</Text>
          {friends.isLoading ? (
            <>
              <FriendSkeletonRow />
              <FriendSkeletonRow />
              <FriendSkeletonRow />
            </>
          ) : friendOnly.length ? (
            friendOnly.map((f) => {
              const seen = lastSeen(f.last_seen_at);
              return (
                <GlassCard key={f.id} style={styles.row}>
                  <Avatar avatar={{ glyph: f.avatar_glyph as GlyphName, color: f.avatar_color as AvatarColor }} size={44} dimmed={!seen.online} />
                  <View style={styles.rowText}>
                    <Text style={type.label} numberOfLines={1}>
                      {f.username}
                    </Text>
                    <View style={styles.status}>
                      <View style={[styles.dot, { backgroundColor: seen.online ? colors.o : colors.textFaint }]} />
                      <Text style={type.caption}>{seen.label.toUpperCase()}</Text>
                    </View>
                  </View>
                  <GlowButton
                    title="Challenge"
                    size="sm"
                    variant={seen.online ? 'coral' : 'glass'}
                    onPress={() => router.push({ pathname: '/challenge', params: { toId: f.id, name: f.username } })}
                  />
                </GlassCard>
              );
            })
          ) : (
            <GlassCard style={styles.empty}>
              <View style={styles.ghosts}>
                <Avatar avatar={{ glyph: 'ghost', color: 'violet' }} size={44} dimmed />
                <Avatar avatar={{ glyph: 'comet', color: 'cyan' }} size={52} dimmed />
                <Avatar avatar={{ glyph: 'flame', color: 'coral' }} size={44} dimmed />
              </View>
              <Text style={[type.body, styles.center]}>No friends yet</Text>
              <Text style={[type.bodyDim, styles.center]}>Joining a match by code adds you as friends.</Text>
            </GlassCard>
          )}
        </>
      ) : (
        <>
          <Text style={type.caption}>{tc.toUpperCase()} LEADERBOARD</Text>
          {leaderboard.length ? (
            leaderboard.map((item, index) => {
              const isMe = item.id === me;
              const rank = index + 1;
              return (
                <GlassCard key={item.id} style={[styles.row, isMe && styles.meRow]}>
                  <View style={styles.rankBox}>
                    {rank === 1 ? (
                      <CrownIcon color={colors.gold} />
                    ) : (
                      <Text style={[type.label, { color: rank <= 3 ? colors.gold : colors.textDim }]}>#{rank}</Text>
                    )}
                  </View>
                  <Avatar avatar={{ glyph: item.avatar_glyph as GlyphName, color: item.avatar_color as AvatarColor }} size={40} />
                  <View style={styles.rowText}>
                    <Text style={type.label} numberOfLines={1}>
                      {item.username} {isMe ? '(You)' : ''}
                    </Text>
                    <Text style={type.caption}>{item.games ?? 0} games played</Text>
                  </View>
                  <View style={styles.ratingVal}>
                    <Text style={[type.numberSmall, { color: rank === 1 ? colors.gold : colors.text }]}>
                      {item.rating ?? 1200}
                    </Text>
                    {(item.games ?? 0) < 10 && <Text style={[type.caption, { color: colors.textFaint }]}>?</Text>}
                  </View>
                </GlassCard>
              );
            })
          ) : (
            <GlassCard style={styles.empty}>
              <Text style={[type.body, styles.center]}>No players yet</Text>
            </GlassCard>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  invite: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  meRow: { borderColor: colors.gold, backgroundColor: withAlpha(colors.gold, 0.08) },
  rowText: { flex: 1, gap: 4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  ghosts: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  rankBox: { width: 32, alignItems: 'center', justifyContent: 'center' },
  ratingVal: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
