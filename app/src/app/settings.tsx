import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { GlassCard } from '@/components/GlassCard';
import { GlowButton } from '@/components/GlowButton';
import { NeonSwitch } from '@/components/NeonSwitch';
import { Screen } from '@/components/Screen';
import { useSettings } from '@/lib/settings';
import { callFade, supabase } from '@/lib/supabase';
import { colors, radii, spacing, type, withAlpha } from '@/theme';

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
  const [showDelete, setShowDelete] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await callFade('delete-account').catch(() => {});
      await supabase.auth.signOut().catch(() => {});
      await AsyncStorage.clear().catch(() => {});
      s.set({ onboarded: false, username: null, userId: null, profileSynced: false });
      setShowDelete(false);
      router.replace('/onboarding');
    } catch {
      setShowDelete(false);
    } finally {
      setDeleting(false);
    }
  };

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
        <Row title={s.username ?? 'Player'} hint="Guest account. Saved on this phone and cloud." />
        <View style={styles.divider} />
        <Row title="Edit name and avatar" onPress={() => router.push('/onboarding?edit=1')}>
          <Text style={[type.label, styles.chev]}>›</Text>
        </Row>
        <View style={styles.divider} />
        <Row title="Delete account & data" hint="Permanently wipe profile and ratings" onPress={() => setShowDelete(true)}>
          <Text style={[type.label, { color: colors.coral }]}>Delete</Text>
        </Row>
      </GlassCard>

      <Text style={type.caption}>LEGAL & ABOUT</Text>
      <GlassCard style={styles.group}>
        <Row title="Privacy Policy" onPress={() => setShowPrivacy(true)}>
          <Text style={[type.label, styles.chev]}>›</Text>
        </Row>
        <View style={styles.divider} />
        <Row title="Terms of Service" onPress={() => setShowTerms(true)}>
          <Text style={[type.label, styles.chev]}>›</Text>
        </Row>
        <View style={styles.divider} />
        <Row title="FADE" hint={`Version ${Constants.expoConfig?.version ?? '1.0.0'}`} />
        {__DEV__ && (
          <>
            <View style={styles.divider} />
            <Row title="Component gallery" hint="Developer only" onPress={() => router.push('/dev/gallery')}>
              <Text style={[type.label, styles.chev]}>›</Text>
            </Row>
          </>
        )}
      </GlassCard>

      {/* Account Deletion BottomSheet */}
      <BottomSheet visible={showDelete} onClose={() => setShowDelete(false)} title="Delete account?">
        <Text style={[type.bodyDim, styles.modalBody]}>
          This permanently deletes your player profile, rating history, and friendships from FADE servers. This action cannot be undone.
        </Text>
        <GlowButton
          title={deleting ? 'Deleting…' : 'Delete permanently'}
          variant="coral"
          size="md"
          disabled={deleting}
          onPress={() => void handleDeleteAccount()}
        />
        <GlowButton title="Cancel" variant="glass" size="md" onPress={() => setShowDelete(false)} />
      </BottomSheet>

      {/* Privacy Policy BottomSheet */}
      <BottomSheet visible={showPrivacy} onClose={() => setShowPrivacy(false)} title="Privacy Policy">
        <Text style={[type.bodyDim, styles.modalBody]}>
          FADE is built privacy-first:{'\n\n'}
          • <Text style={type.body}>No Tracking:</Text> We do not collect real names, phone numbers, email addresses, contact books, GPS location, or advertising IDs.{'\n\n'}
          • <Text style={type.body}>Minimal Gameplay Data:</Text> We only store an anonymous account ID, your chosen display name, avatar customization, and match records to calculate fair Glicko-2 ratings.{'\n\n'}
          • <Text style={type.body}>Security & Deletion:</Text> All data is encrypted in transit and at rest on Supabase EU infrastructure. You can permanently delete your data at any time via Settings.
        </Text>
        <GlowButton title="Close" variant="glass" size="md" onPress={() => setShowPrivacy(false)} />
      </BottomSheet>

      {/* Terms BottomSheet */}
      <BottomSheet visible={showTerms} onClose={() => setShowTerms(false)} title="Terms of Service">
        <Text style={[type.bodyDim, styles.modalBody]}>
          • <Text style={type.body}>Fair Play:</Text> FADE is a timed strategy game. Automated gameplay scripting or protocol tampering in rated matches is strictly prohibited.{'\n\n'}
          • <Text style={type.body}>Ratings Authority:</Text> Match clocks, outcomes, and Glicko-2 ratings are calculated authoritatively on the server.{'\n\n'}
          • <Text style={type.body}>Service Availability:</Text> FADE is provided as-is. We work continuously to maintain low-latency multiplayer servers.
        </Text>
        <GlowButton title="Close" variant="glass" size="md" onPress={() => setShowTerms(false)} />
      </BottomSheet>
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
  modalBody: { lineHeight: 22, marginVertical: spacing.xs },
});
