import Phaser from "phaser";
import { readSafeAreaInsets, safeRectInGame, type SafeInsets } from "./SafeArea";

export const DESIGN_PORTRAIT = { width: 720, height: 1280 } as const;
export const DESIGN_LANDSCAPE = { width: 1280, height: 720 } as const;
export const PORTRAIT = { w: 720, h: 1280 };
export const LANDSCAPE = { w: 1280, h: 720 };

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  w: number;
  h: number;
}

export function designSize(availW: number, availH: number): { w: number; h: number; width: number; height: number; portrait: boolean } {
  const portrait = availH >= availW;
  const d = portrait ? PORTRAIT : LANDSCAPE;
  return { w: d.w, h: d.h, width: d.w, height: d.h, portrait };
}

export function applyDesignSize(scale: Phaser.Scale.ScaleManager): void {
  const w = window.visualViewport?.width ?? window.innerWidth;
  const h = window.visualViewport?.height ?? window.innerHeight;
  if (w <= 0 || h <= 0) return;
  const d = designSize(w, h);
  if (scale.gameSize.width !== d.w || scale.gameSize.height !== d.h) {
    scale.setGameSize(d.w, d.h);
  }
}

let orientationDebounce: ReturnType<typeof setTimeout> | null = null;
let lastOrientation: 'portrait' | 'landscape' | null = null;

export function applyOrientationSize(game: Phaser.Game): void {
  const w = window.visualViewport?.width ?? window.innerWidth;
  const h = window.visualViewport?.height ?? window.innerHeight;
  if (w <= 0 || h <= 0) return;
  
  const currentOrientation = h >= w ? 'portrait' : 'landscape';
  if (lastOrientation !== null && lastOrientation === currentOrientation) {
    return;
  }
  
  if (orientationDebounce) {
    clearTimeout(orientationDebounce);
  }
  
  orientationDebounce = setTimeout(() => {
    lastOrientation = currentOrientation;
    applyDesignSize(game.scale);
    orientationDebounce = null;
  }, 100);
}

export function attachViewportListeners(cb: () => void): () => void {
  window.addEventListener("resize", cb);
  window.addEventListener("orientationchange", cb);
  window.visualViewport?.addEventListener("resize", cb);
  return () => {
    window.removeEventListener("resize", cb);
    window.removeEventListener("orientationchange", cb);
    window.visualViewport?.removeEventListener("resize", cb);
  };
}

export function isPortrait(scale: Phaser.Scale.ScaleManager): boolean {
  return scale.height >= scale.width;
}

/** HUD lives inside the safe rect. */
export function hudRect(scale: Phaser.Scale.ScaleManager): Rect {
  const s = safeRectInGame(scale);
  return { x: s.x, y: s.y, width: s.w, height: s.h, w: s.w, h: s.h };
}

export function safeHudRect(viewportWidth: number, viewportHeight: number, insets?: SafeInsets): Rect {
  const pad = insets ?? readSafeAreaInsets();
  const width = Math.max(0, viewportWidth - pad.left - pad.right);
  const height = Math.max(0, viewportHeight - pad.top - pad.bottom);
  return { x: pad.left, y: pad.top, width, height, w: width, h: height };
}


export function pickDesignSize(): { width: number; height: number; w: number; h: number; portrait: boolean } {
  const w = window.visualViewport?.width ?? window.innerWidth;
  const h = window.visualViewport?.height ?? window.innerHeight;
  return designSize(w, h);
}
