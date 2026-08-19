import Phaser from "phaser";

export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export type Insets = SafeInsets;

function pxVar(style: CSSStyleDeclaration, name: string): number {
  const n = parseFloat(style.getPropertyValue(name).trim());
  return Number.isFinite(n) ? n : 0;
}

export function readSafeAreaInsets(el: Element = document.body): SafeInsets {
  const style = getComputedStyle(el);
  return {
    top: pxVar(style, "--safe-area-inset-top"),
    right: pxVar(style, "--safe-area-inset-right"),
    bottom: pxVar(style, "--safe-area-inset-bottom"),
    left: pxVar(style, "--safe-area-inset-left"),
  };
}

export function readCssInsets(): SafeInsets {
  return readSafeAreaInsets(document.body);
}

export function safeRectCss(): { x: number; y: number; w: number; h: number } {
  const i = readSafeAreaInsets();
  const vv = window.visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const h = vv?.height ?? window.innerHeight;
  return { x: i.left, y: i.top, w: Math.max(0, w - i.left - i.right), h: Math.max(0, h - i.top - i.bottom) };
}

export function safeRectInGame(scale: Phaser.Scale.ScaleManager): { x: number; y: number; w: number; h: number } {
  const insets = readSafeAreaInsets();
  const canvas = scale.canvas.getBoundingClientRect();
  const vv = window.visualViewport;
  const vx = vv?.offsetLeft ?? 0;
  const vy = vv?.offsetTop ?? 0;
  const vw = vv?.width ?? window.innerWidth;
  const vh = vv?.height ?? window.innerHeight;
  const safeL = vx + insets.left;
  const safeT = vy + insets.top;
  const safeR = vx + vw - insets.right;
  const safeB = vy + vh - insets.bottom;
  const interL = Math.max(canvas.left, safeL);
  const interT = Math.max(canvas.top, safeT);
  const interR = Math.min(canvas.right, safeR);
  const interB = Math.min(canvas.bottom, safeB);
  const gw = scale.gameSize.width;
  const gh = scale.gameSize.height;
  const cw = Math.max(1, canvas.width);
  const ch = Math.max(1, canvas.height);
  return {
    x: ((interL - canvas.left) / cw) * gw,
    y: ((interT - canvas.top) / ch) * gh,
    w: Math.max(0, ((interR - interL) / cw) * gw),
    h: Math.max(0, ((interB - interT) / ch) * gh),
  };
}
