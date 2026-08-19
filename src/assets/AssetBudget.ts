import Phaser from 'phaser';

/**
 * iPhone decode budget (SLOT-RES-0819):
 * - decoded VRAM / decode working set ~80–120MB
 * - atlas edge ≤2048 (do not ship larger sheets)
 * - simultaneous big atlases ≤3 + 1 UI atlas
 * WebP saves download size only; GPU decode is still RGBA.
 *
 * Unload order (must destroy game objects BEFORE removing textures):
 * 1. stop tweens
 * 2. destroy game objects / sounds
 * 3. anims.remove
 * 4. textures.remove
 * 5. cache.audio / cache.json remove
 *
 * Same texture key loaded twice does not re-queue.
 * After unload, do not reuse that key for a different image.
 */
export const IPHONE_DECODE_MB = { min: 80, max: 120 };
export const MAX_ATLAS_EDGE = 2048;
export const MAX_BIG_ATLASES = 3;
export const MAX_UI_ATLASES = 1;
export const MAX_PARALLEL_DOWNLOADS = 4;

export function atlasSlotOk(count: number, edge: number): boolean {
  return count <= MAX_BIG_ATLASES && edge <= MAX_ATLAS_EDGE;
}

export type UnloadKeys = {
  objects?: Phaser.GameObjects.GameObject[];
  textures?: string[];
  audio?: string[];
  json?: string[];
  anims?: string[];
};

export function unloadSceneAssets(scene: Phaser.Scene, keys: UnloadKeys): void {
  scene.tweens.killAll();

  keys.objects?.forEach((obj) => {
    if (obj && obj.active !== undefined) obj.destroy();
  });

  keys.audio?.forEach((key) => {
    scene.sound.stopByKey(key);
    scene.sound.removeByKey(key);
  });

  keys.anims?.forEach((key) => {
    scene.anims.remove(key);
  });

  keys.textures?.forEach((key) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    AssetBudget.markRetired(key);
  });

  keys.audio?.forEach((key) => {
    if (scene.cache.audio.exists(key)) scene.cache.audio.remove(key);
  });

  keys.json?.forEach((key) => {
    if (scene.cache.json.exists(key)) scene.cache.json.remove(key);
  });
}

export const TEX = { symbols: 'symbols', ui: 'ui', bootMark: 'boot-mark' } as const;
export const CACHE = { paytable: 'paytable' } as const;
export const SFX = { spin: 'sfx-spin', stop: 'sfx-stop', win: 'sfx-win' } as const;

const queued = new Set<string>();
const retired = new Set<string>();

export const AssetBudget = {
  queued,
  retired,
  canQueue(key: string): boolean {
    return !queued.has(key);
  },
  markQueued(key: string): void {
    queued.add(key);
  },
  isRetired(key: string): boolean {
    return retired.has(key);
  },
  markRetired(key: string): void {
    retired.add(key);
    queued.delete(key);
  },
  assertAtlasSize(width: number, height: number): void {
    if (width > MAX_ATLAS_EDGE || height > MAX_ATLAS_EDGE) {
      throw new Error(`atlas edge ${width}x${height} exceeds ${MAX_ATLAS_EDGE}`);
    }
  },
};
