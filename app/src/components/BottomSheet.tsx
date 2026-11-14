import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, radii, spacing, type } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Glass bottom sheet: springs up, drag down or tap the backdrop to dismiss. */
export function BottomSheet({ visible, onClose, title, children }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(height);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
      backdrop.value = withTiming(1, { duration: 220 });
    } else if (mounted) {
      backdrop.value = withTiming(0, { duration: 180 });
      y.value = withTiming(height, { duration: 220, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      });
    }
  }, [visible, mounted, height, y, backdrop]);

  const pan = usePanGesture({
    onUpdate: (e) => {
      y.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      if (e.translationY > 110 || e.velocityY > 900) {
        scheduleOnRN(onClose);
      } else {
        y.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) });
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!mounted) return null;
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }, sheetStyle]}>
            <LinearGradient
              pointerEvents="none"
              colors={[colors.glassStrong, colors.transparent]}
              style={[StyleSheet.absoluteFill, styles.sheetShine]}
            />
            <View style={styles.handle} />
            {title ? <Text style={[type.heading, styles.title]}>{title}</Text> : null}
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.night,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  sheetShine: { borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairlineBright,
  },
  title: { textAlign: 'center' },
});
