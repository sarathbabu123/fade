import { useReducedMotion } from 'react-native-reanimated';

import { useSettings } from './settings';

/** True if the user (in Settings) or the OS asked for reduced motion. */
export function useReduceMotion(): boolean {
  const os = useReducedMotion();
  const app = useSettings((s) => s.reduceMotion);
  return os || app;
}
