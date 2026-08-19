import Phaser from 'phaser';
import { pickDesignSize } from '../layout/Layout';
import { MAX_PARALLEL_DOWNLOADS } from '../assets/AssetBudget';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { GameScene } from '../scenes/GameScene';
import { PaytableScene } from '../scenes/PaytableScene';

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  const design = pickDesignSize();
  return {
    type: Phaser.AUTO,
    parent: 'game',
    width: design.width,
    height: design.height,
    backgroundColor: '#12121c',
    audio: {
      disableWebAudio: false,
    },
    loader: {
      maxParallelDownloads: MAX_PARALLEL_DOWNLOADS,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: design.width,
      height: design.height,
    },
    scene: [BootScene, PreloadScene, GameScene, PaytableScene],
  };
}

export const gameConfig = createGameConfig;
