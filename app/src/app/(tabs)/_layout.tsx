import { Redirect } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';

import { TAB_ROUTES, TabBarContent } from '@/components/TabBar';
import { useSettings } from '@/lib/settings';

export default function TabsLayout() {
  const onboarded = useSettings((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs>
      <TabSlot />
      {/* Route registry for the tab navigator; the visible bar is TabBarContent. */}
      <TabList style={styles.hidden}>
        {TAB_ROUTES.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} />
        ))}
      </TabList>
      <View style={styles.floating} pointerEvents="box-none">
        <TabBarContent />
      </View>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  floating: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
