import { Canvas, DashPathEffect, Path, Skia } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Avatar } from '@/components/Avatar';
import { GlassCard } from '@/components/GlassCard';
import { GearIcon } from '@/components/Icons';
import { RatingChip } from '@/components/RatingChip';
import { Screen } from '@/components/Screen';
import { useSettings } from '@/lib/settings';
import { colors, spacing, type, withAlpha } from '@/theme';

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

const STATS = [
  { label: 'WINS', value: 0, color: colors.gold },
  { label: 'DRAWS', value: 0, color: colors.text },
  { label: 'LOSSES', value: 0, color: colors.textDim },
  { label: 'BEST STREAK', value: 0, color: colors.x },
];

export default function ProfileScreen() {
  const avatar = useSettings((s) => s.avatar);
  const username = useSettings((s) => s.username);
  const { width } = useWindowDimensions();

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
        <View style={styles.flex}>
          <RatingChip label="Rapid" rating={1200} provisional />
        </View>
        <View style={styles.flex}>
          <RatingChip label="Blitz" rating={1200} provisional />
        </View>
      </View>

      <GlassCard style={styles.graphCard}>
        <Text style={type.caption}>RATING</Text>
        <EmptyGraph width={width - spacing.xl * 2 - spacing.lg * 2} />
        <Text style={type.bodyDim}>Your graph starts after your first rated match.</Text>
      </GlassCard>

      <View style={styles.stats}>
        {STATS.map((s) => (
          <GlassCard key={s.label} style={styles.stat}>
            <AnimatedNumber value={s.value} style={{ ...type.number, color: s.color }} />
            <Text style={type.caption}>{s.label}</Text>
          </GlassCard>
        ))}
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
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexBasis: '47%', flexGrow: 1, gap: spacing.xs },
});
