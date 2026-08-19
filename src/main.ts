import Phaser from 'phaser';
import { RestGameClient } from './client/RestGameClient';
import { createGameConfig } from './game/config';
import { applyOrientationSize } from './layout/Layout';

void RestGameClient;

let game: Phaser.Game | null = null;

if ('hot' in import.meta) {
  const hot = (import.meta as { hot?: { dispose: (cb: () => void) => void } }).hot;
  hot?.dispose(() => {
    if (game) {
      game.destroy(true);
      game = null;
    }
  });
}

game = new Phaser.Game(createGameConfig());

const onViewport = (): void => {
  if (game) applyOrientationSize(game);
};
window.addEventListener('resize', onViewport);
window.addEventListener('orientationchange', onViewport);
window.visualViewport?.addEventListener('resize', onViewport);
