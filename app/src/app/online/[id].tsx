import { useLocalSearchParams } from 'expo-router';

import { OnlineSosMatch } from '@/game/sos/OnlineSosMatch';
import { useOnlineMatch } from '@/game/useOnlineMatch';

import { MatchScreen } from '../match';

/** An online match (server-authoritative for FADE or SOS). */
export default function OnlineMatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctl = useOnlineMatch(String(id));

  if (ctl.online.isSos) {
    return <OnlineSosMatch ctl={ctl} />;
  }

  return <MatchScreen ctl={ctl} online={ctl.online} />;
}
