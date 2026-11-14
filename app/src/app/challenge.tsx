import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { GlassCard } from '@/components/GlassCard';
import { GlowButton } from '@/components/GlowButton';
import { NeonLoader } from '@/components/NeonLoader';
import { Screen } from '@/components/Screen';
import { ensureSignedIn, saveProfile } from '@/lib/account';
import { challengeMessage, shareOnWhatsApp } from '@/lib/links';
import { haptic, useSettings } from '@/lib/settings';
import { callFade, supabase } from '@/lib/supabase';
import { colors, fonts, glow, radii, spacing, type, withAlpha } from '@/theme';

export default function ChallengeScreen() {
  const { toId, name, game: initialGame } = useLocalSearchParams<{ toId?: string; name?: string; game?: string }>();
  const game = initialGame === 'sos' ? 'sos' : 'fade';
  const tc = useSettings((s) => s.timeControl);
  const rated = useSettings((s) => s.rated);
  const username = useSettings((s) => s.username);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(600);
  const done = useRef(false);

  useEffect(() => {
    ensureSignedIn()
      .then(async () => {
        if (!useSettings.getState().profileSynced) await saveProfile();
        return callFade<{ code: string }>('create-challenge', { timeControl: tc, toId: toId ?? null, rated, game });
      })
      .then((r) => {
        setCode(r.code);
        haptic.success();
      })
      .catch((e: Error) => setError(e.message));
  }, [tc, toId, rated, game]);

  // Wait for the friend: realtime on our challenge row, plus a poll as a fallback.
  useEffect(() => {
    if (!code) return;
    const go = (row: { status?: string; match_id?: string | null } | null) => {
      if (done.current || !row) return;
      if (row.status === 'accepted' && row.match_id) {
        done.current = true;
        haptic.success();
        router.replace({ pathname: '/online/[id]', params: { id: row.match_id } });
      }
    };
    const channel = supabase
      .channel(`challenge-${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'challenges', filter: `code=eq.${code}` }, (p) => go(p.new as never))
      .subscribe();
    const poll = setInterval(async () => {
      const { data } = await supabase.from('challenges').select('status, match_id').eq('code', code).maybeSingle();
      go(data);
    }, 2000);
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      void supabase.removeChannel(channel);
    };
  }, [code]);

  const cancel = () => {
    if (code && !done.current) void callFade('cancel-challenge', { code }).catch(() => {});
    router.back();
  };

  const message = code ? challengeMessage(code, username, tc, game) : '';
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <Screen>
      <Pressable onPress={cancel} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel challenge">
        <Text style={[type.label, styles.back]}>‹ Cancel</Text>
      </Pressable>
      <Text style={type.title}>{name ? `Challenge ${name}` : game === 'sos' ? 'SOS Duel Challenge' : 'Challenge a friend'}</Text>
      <Text style={type.bodyDim}>
        {name
          ? `${name} gets a banner in FADE. You can also send them this code.`
          : 'Send this code on WhatsApp. Your friend opens FADE, taps “Enter a code” and types it.'}
      </Text>

      <GlassCard glowColor={game === 'sos' ? colors.coral : colors.x} style={styles.codeCard}>
        <Text style={type.caption}>
          {game === 'sos' ? 'SOS DUEL · 5×5 GRID' : tc === 'blitz' ? 'BLITZ · 3 S A MOVE' : 'RAPID · 8 S A MOVE'}
        </Text>
        {code ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.codeRow} accessible accessibilityLabel={`Code ${code.split('').join(' ')}`}>
            {code.split('').map((ch, i) => (
              <View key={i} style={styles.letter}>
                <Text style={styles.letterText}>{ch}</Text>
              </View>
            ))}
          </Animated.View>
        ) : error ? (
          <Text style={[type.label, { color: colors.coral }]}>{error}</Text>
        ) : (
          <NeonLoader size="md" label="Making your code…" />
        )}
        {code && <Text style={type.caption}>EXPIRES IN {mm}:{ss}</Text>}
      </GlassCard>

      <GlowButton title="Share on WhatsApp" subtitle="Code + app link, ready to send" disabled={!code} onPress={() => void shareOnWhatsApp(message)} />
      <GlowButton title="Other apps…" variant="glass" size="md" disabled={!code} onPress={() => void Share.share({ message })} />

      {code && (
        <View style={styles.waiting}>
          <NeonLoader size="sm" label="Waiting for your friend to join…" />
        </View>
      )}
      {!code && error && <GlowButton title="Try again" variant="glass" size="md" onPress={() => router.replace('/challenge')} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.textDim },
  codeCard: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  codeRow: { flexDirection: 'row', gap: spacing.sm },
  letter: {
    width: 44,
    height: 58,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: withAlpha(colors.x, 0.6),
    backgroundColor: withAlpha(colors.x, 0.08),
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: glow(colors.x, 10, 0.3),
  },
  letterText: { fontFamily: fonts.displayHeavy, fontSize: 28, color: colors.text },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, justifyContent: 'center', marginTop: spacing.sm },
  waitWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  waitRing: { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.o },
  waitDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.o },
});
