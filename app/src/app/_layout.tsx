import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Unbounded_500Medium, Unbounded_700Bold, Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuroraBackground } from '@/components/AuroraBackground';
import { IncomingChallenge } from '@/components/IncomingChallenge';
import { useAccount } from '@/lib/account';
import { useSettingsHydrated } from '@/lib/settings';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Unbounded_500Medium,
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  const hydrated = useSettingsHydrated();
  // Anonymous sign-in, profile sync and presence heartbeat run in the background.
  useAccount();
  const ready = fontsLoaded && hydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        {/* One aurora behind every screen, so it never restarts on navigation. */}
        <AuroraBackground />
        {ready ? (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.transparent },
              animation: 'fade_from_bottom',
            }}
          />
        ) : (
          <View style={styles.root} />
        )}
        {ready && <IncomingChallenge />}
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
});
