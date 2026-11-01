import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { NeonSwitch } from '@/components/NeonSwitch';
import { Screen } from '@/components/Screen';
import { useSettings } from '@/lib/settings';
import { colors, spacing, type } from '@/theme';

function Row({ title, hint, children, onPress }: { title: string; hint?: string; children?: ReactNode; onPress?: () => void }) {
  const body = (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={type.body}>{title}</Text>
        {hint ? <Text style={[type.bodyDim, styles.hint]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

export default function SettingsScreen() {
  const s = useSettings();
  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
        <Text style={[type.label, styles.back]}>‹ Back</Text>
      </Pressable>
      <Text style={type.title}>Settings</Text>

      <Text style={type.caption}>FEEL</Text>
      <GlassCard style={styles.group}>
        <Row title="Sound" hint="Strokes, fades and wins">
          <NeonSwitch label="Sound" value={s.sound} onChange={(v) => s.set({ sound: v })} />
        </Row>
        <View style={styles.divider} />
        <Row title="Haptics" hint="Taps, fades and the clock heartbeat">
          <NeonSwitch label="Haptics" value={s.haptics} onChange={(v) => s.set({ haptics: v })} />
        </Row>
        <View style={styles.divider} />
        <Row title="Reduce motion" hint="Simple fades instead of particles and shakes">
          <NeonSwitch label="Reduce motion" value={s.reduceMotion} onChange={(v) => s.set({ reduceMotion: v })} />
        </Row>
      </GlassCard>

      <Text style={type.caption}>ACCOUNT</Text>
      <GlassCard style={styles.group}>
        <Row title={s.username ?? 'Player'} hint="Guest account. Saved on this phone only for now." />
        <View style={styles.divider} />
        <Row title="Edit name and avatar" onPress={() => router.push('/onboarding?edit=1')}>
          <Text style={[type.label, styles.chev]}>›</Text>
        </Row>
      </GlassCard>

      <Text style={type.caption}>ABOUT</Text>
      <GlassCard style={styles.group}>
        <Row title="FADE" hint={`Version ${Constants.expoConfig?.version ?? '0.1.0'}`} />
        {__DEV__ && (
          <>
            <View style={styles.divider} />
            <Row title="Component gallery" hint="Developer only" onPress={() => router.push('/dev/gallery')}>
              <Text style={[type.label, styles.chev]}>›</Text>
            </Row>
          </>
        )}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.textDim },
  group: { paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  hint: { fontSize: 13, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  chev: { color: colors.textFaint, fontSize: 22 },
});
