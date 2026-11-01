import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

import { TAB_BAR_SPACE } from './TabBar';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  /** Leave room for the floating tab bar. */
  tabs?: boolean;
}

/** Content area on top of the app-wide aurora, with safe-area padding. */
export function Screen({ children, scroll = true, tabs = false }: Props) {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: insets.top + spacing.lg,
    paddingBottom: insets.bottom + spacing.xl + (tabs ? TAB_BAR_SPACE : 0),
  };
  if (!scroll) return <View style={[styles.content, styles.fill, pad]}>{children}</View>;
  return (
    <ScrollView style={styles.fill} contentContainerStyle={[styles.content, pad]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
});
