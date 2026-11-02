import { useLocalSearchParams } from 'expo-router';

import { useOnlineMatch } from '@/game/useOnlineMatch';

import { MatchScreen } from '../match';

/** An online match (server-authoritative). */
export default function OnlineMatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctl = useOnlineMatch(String(id));
  return <MatchScreen ctl={ctl} online={ctl.online} />;
}
