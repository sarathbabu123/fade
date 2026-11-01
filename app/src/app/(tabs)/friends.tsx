import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { GlassCard } from '@/components/GlassCard';
import { GlowButton } from '@/components/GlowButton';
import { KeyIcon, SwordsIcon } from '@/components/Icons';
import { Screen } from '@/components/Screen';
import { colors, spacing, type } from '@/theme';

export default function FriendsScreen() {
  return (
    <Screen tabs>
      <Text style={type.title}>Friends</Text>

      <GlassCard glowColor={colors.x} style={styles.invite}>
        <Text style={type.heading}>Play someone you know</Text>
        <Text style={type.bodyDim}>
          Create a 6-letter challenge code and send it on WhatsApp with the app link. They type it in, you play.
        </Text>
        <GlowButton
          title="Create challenge"
          icon={<SwordsIcon color={colors.onAccent} />}
          variant="coral"
          size="md"
        />
        <GlowButton title="I have a code" icon={<KeyIcon />} variant="glass" size="md" />
      </GlassCard>

      <Text style={type.caption}>YOUR FRIENDS</Text>
      <GlassCard style={styles.empty}>
        <View style={styles.ghosts}>
          <Avatar avatar={{ glyph: 'ghost', color: 'violet' }} size={44} dimmed />
          <Avatar avatar={{ glyph: 'comet', color: 'cyan' }} size={52} dimmed />
          <Avatar avatar={{ glyph: 'flame', color: 'coral' }} size={44} dimmed />
        </View>
        <Text style={[type.body, styles.center]}>No friends yet</Text>
        <Text style={[type.bodyDim, styles.center]}>Joining a match by code adds you as friends.</Text>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  invite: { gap: spacing.md },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  ghosts: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  center: { textAlign: 'center' },
});
