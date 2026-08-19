import Phaser from 'phaser';
import { SYMBOLS } from '../domain/ReelStrip';
import { MAX_ATLAS_EDGE } from './AssetBudget';

const PALETTE: Record<string, string> = {
  A: '#e74c3c',
  K: '#e67e22',
  Q: '#f1c40f',
  J: '#2ecc71',
  T: '#1abc9c',
  N9: '#3498db',
  N8: '#9b59b6',
  STAR: '#ecf0f1',
  WILD: '#ffd700',
};

const CELL = 128;

/** Tiny programmatic atlas (color blocks + blur frames). No downloaded art pack. */
export function createSymbolAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists('symbols')) return;

  const names = [...SYMBOLS, ...SYMBOLS.map((s) => `${s}_blur`)];
  const cols = 6;
  const rows = Math.ceil(names.length / cols);
  const w = cols * CELL;
  const h = rows * CELL;
  if (w > MAX_ATLAS_EDGE || h > MAX_ATLAS_EDGE) {
    throw new Error('symbol atlas exceeds MAX_ATLAS_EDGE');
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context');

  names.forEach((name, i) => {
    const x = (i % cols) * CELL;
    const y = Math.floor(i / cols) * CELL;
    const base = name.endsWith('_blur') ? name.slice(0, -5) : name;
    const color = PALETTE[base] ?? '#555555';
    if (name.endsWith('_blur')) {
      const grd = ctx.createLinearGradient(x, y, x, y + CELL);
      grd.addColorStop(0, '#1a1a22');
      grd.addColorStop(0.45, color);
      grd.addColorStop(0.55, color);
      grd.addColorStop(1, '#1a1a22');
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, CELL, CELL);
    } else {
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = color;
      ctx.fillRect(x + 8, y + 8, CELL - 16, CELL - 16);
      ctx.fillStyle = base === 'WILD' || base === 'STAR' ? '#222222' : '#111111';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(base === 'STAR' ? '★' : base, x + CELL / 2, y + CELL / 2);
    }
  });

  scene.textures.addCanvas('symbols', canvas);
  const tex = scene.textures.get('symbols');
  names.forEach((name, i) => {
    const x = (i % cols) * CELL;
    const y = Math.floor(i / cols) * CELL;
    tex.add(name, 0, x, y, CELL, CELL);
  });
}

export function createBootLogo(scene: Phaser.Scene): void {
  if (scene.textures.exists('boot-logo')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffd34e, 1);
  g.fillRoundedRect(0, 0, 96, 96, 18);
  g.fillStyle(0x1a1a22, 1);
  g.fillTriangle(48, 18, 78, 74, 18, 74);
  g.generateTexture('boot-logo', 96, 96);
  g.destroy();
}

export function createPaytablePanel(scene: Phaser.Scene): void {
  if (scene.textures.exists('paytable-ui')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x0e0e18, 0.92);
  g.fillRoundedRect(0, 0, 64, 64, 8);
  g.lineStyle(2, 0xffd34e, 1);
  g.strokeRoundedRect(2, 2, 60, 60, 8);
  g.generateTexture('paytable-ui', 64, 64);
  g.destroy();
}
