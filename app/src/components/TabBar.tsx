import { TabTrigger } from 'expo-router/ui';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentRef, ComponentType, Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/settings';
import { colors, glow, motion, radii, spacing, type, withAlpha } from '@/theme';

import { FriendsIcon, PlayIcon, ProfileIcon } from './Icons';

/** Height the floating bar takes over content (bar + gap), excluding the safe area. */
export const TAB_BAR_SPACE = 76;

type TabButtonProps = TabTriggerSlotProps & {
  label: string;
  Icon: ComponentType<{ color?: string; size?: number }>;
  accent: string;
};

function TabButton({ isFocused, label, Icon, accent, ref, ...props }: TabButtonProps) {
  const pill = useAnimatedStyle(() => ({
    opacity: withTiming(isFocused ? 1 : 0, { duration: 150 }),
    transform: [{ scale: withTiming(isFocused ? 1 : 0.88, { duration: 150 }) }],
  }));
  const color = isFocused ? accent : colors.textFaint;
  return (
    <Pressable
      {...props}
      // expo-router/ui types the slot ref loosely; it is the Pressable's host view.
      ref={ref as Ref<ComponentRef<typeof Pressable>>}
      onPressIn={() => haptic.selection()}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      style={styles.tab}>
      <Animated.View style={[styles.pill, { backgroundColor: withAlpha(accent, 0.12), boxShadow: glow(accent, 16, 0.25) }, pill]} />
      <Icon color={color} size={22} />
      <Text style={[type.caption, styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const TABS = [
  { name: 'index', href: '/' as const, label: 'PLAY', Icon: PlayIcon, accent: colors.x },
  { name: 'friends', href: '/friends' as const, label: 'FRIENDS', Icon: FriendsIcon, accent: colors.o },
  { name: 'profile', href: '/profile' as const, label: 'PROFILE', Icon: ProfileIcon, accent: colors.gold },
];

/** Floating glass tab bar. Rendered inside expo-router/ui's <TabList>. */
export function TabBarContent() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { marginBottom: insets.bottom + spacing.sm }]}>
      {TABS.map((t) => (
        <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
          <TabButton label={t.label} Icon={t.Icon} accent={t.accent} />
        </TabTrigger>
      ))}
    </View>
  );
}

export const TAB_ROUTES = TABS;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    padding: spacing.xs + 2,
    borderRadius: radii.xl,
    backgroundColor: withAlpha(colors.nightDeep, 0.9),
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, gap: 3 },
  pill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radii.lg },
  label: { fontSize: 10, letterSpacing: 1.4 },
});
