import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GlowButton } from '@/components/GlowButton';
import { Screen } from '@/components/Screen';
import { ensureSignedIn, saveProfile } from '@/lib/account';
import { haptic, useSettings } from '@/lib/settings';
import { callFade } from '@/lib/supabase';
import { colors, fonts, glow, radii, spacing, type, withAlpha } from '@/theme';

/** Type a friend's 6-letter challenge code to join their match. */
export default function JoinScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((params.code ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await ensureSignedIn();
      if (!useSettings.getState().profileSynced) await saveProfile();
      const r = await callFade<{ matchId: string }>('accept-challenge', { code });
      haptic.success();
      router.replace({ pathname: '/online/[id]', params: { id: r.matchId } });
    } catch (e) {
      setError((e as Error).message);
      haptic.medium();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={[type.label, styles.back]}>‹ Back</Text>
      </Pressable>
      <Text style={type.title}>Enter a code</Text>
      <Text style={type.bodyDim}>Type the 6 letters your friend sent you on WhatsApp.</Text>

      <Pressable onPress={() => input.current?.focus()} style={styles.boxes} accessibilityLabel="Code input">
        {Array.from({ length: 6 }, (_, i) => {
          const filled = i < code.length;
          const active = i === code.length;
          return (
            <View key={i} style={[styles.box, filled && styles.boxFilled, active && styles.boxActive]}>
              <Text style={styles.boxText}>{code[i] ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(t) => {
          setError(null);
          setCode(t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6));
        }}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        style={styles.hidden}
        onSubmitEditing={() => code.length === 6 && void join()}
      />
      {error ? <Text style={[type.label, styles.error]}>{error}</Text> : null}
      <GlowButton title={busy ? 'Joining…' : 'Join match'} variant="cyan" disabled={code.length !== 6 || busy} onPress={() => void join()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.textDim },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  box: {
    width: 46,
    height: 60,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: withAlpha(colors.o, 0.6), backgroundColor: withAlpha(colors.o, 0.08) },
  boxActive: { borderColor: colors.o, boxShadow: glow(colors.o, 12, 0.4) },
  boxText: { fontFamily: fonts.displayHeavy, fontSize: 28, color: colors.text },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  error: { color: colors.alarm, textAlign: 'center' },
});
