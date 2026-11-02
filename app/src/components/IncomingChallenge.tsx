import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { playSound } from '@/game/sounds';
import { haptic, useSettings } from '@/lib/settings';
import { callFade, supabase } from '@/lib/supabase';
import { colors, glow, radii, spacing, type, withAlpha } from '@/theme';

import { GlowButton } from './GlowButton';

interface Incoming {
  code: string;
  fromName: string;
  timeControl: string;
}

/** App-wide banner when a friend challenges you from their Friends list. */
export function IncomingChallenge() {
  const insets = useSafeAreaInsets();
  const me = useSettings((s) => s.userId);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    const show = async (row: { code: string; from_id: string; status: string; time_control: string; expires_at: string }) => {
      if (row.status !== 'open' || Date.parse(row.expires_at) < Date.now()) {
        setIncoming((cur) => (cur?.code === row.code ? null : cur));
        return;
      }
      const { data } = await supabase.from('profiles').select('username').eq('id', row.from_id).maybeSingle();
      setIncoming({ code: row.code, fromName: data?.username ?? 'A friend', timeControl: row.time_control });
      playSound('ready');
      haptic.medium();
    };
    const channel = supabase
      .channel(`incoming-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges', filter: `to_id=eq.${me}` }, (p) => void show(p.new as never))
      .subscribe();
    // Anything still open from before the app opened.
    void supabase
      .from('challenges')
      .select('code, from_id, status, time_control, expires_at')
      .eq('to_id', me)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => data?.[0] && void show(data[0]));
    return () => void supabase.removeChannel(channel);
  }, [me]);

  if (!incoming) return null;

  const accept = async () => {
    setBusy(true);
    try {
      const r = await callFade<{ matchId: string }>('accept-challenge', { code: incoming.code });
      setIncoming(null);
      router.push({ pathname: '/online/[id]', params: { id: r.matchId } });
    } catch {
      setIncoming(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View entering={SlideInUp.springify().damping(14)} exiting={SlideOutUp} style={[styles.wrap, { top: insets.top + spacing.sm }]}>
      <View style={styles.card}>
        <Text style={type.label} numberOfLines={1}>
          ⚔️ {incoming.fromName} challenged you
        </Text>
        <Text style={type.caption}>{incoming.timeControl === 'blitz' ? 'BLITZ · 3 S' : 'RAPID · 8 S'}</Text>
        <View style={styles.buttons}>
          <GlowButton title={busy ? 'Joining…' : 'Accept'} size="sm" disabled={busy} onPress={() => void accept()} />
          <GlowButton title="Not now" size="sm" variant="glass" onPress={() => setIncoming(null)} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 100 },
  card: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.x, 0.6),
    backgroundColor: withAlpha(colors.nightDeep, 0.96),
    boxShadow: glow(colors.x, 20, 0.35),
    gap: spacing.xs,
  },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
