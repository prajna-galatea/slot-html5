import type { GameClient } from './GameClient';
import { LocalGameClient } from './LocalGameClient';
import { RestGameClient } from './RestGameClient';

/** View talks only to GameClient. Swap local → rest without changing scenes. */
export function createGameClient(kind: 'local' | 'rest' = 'local'): GameClient {
  if (kind === 'rest') return new RestGameClient();
  return new LocalGameClient();
}
