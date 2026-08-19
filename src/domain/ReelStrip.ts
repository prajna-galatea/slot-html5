/** Five reel strips (each length >= 20) and wrap helpers. */

export const REEL_COUNT = 5;
export const VISIBLE_ROWS = 3;

export const SYMBOLS = ["A", "K", "Q", "J", "T", "N9", "N8", "STAR", "WILD"] as const;
export type SymbolId = (typeof SYMBOLS)[number];

export const STRIPS: string[][] = [
  ["A", "K", "N8", "Q", "WILD", "J", "T", "STAR", "N9", "A", "K", "Q", "J", "N8", "T", "STAR", "N9", "K", "A", "Q", "J", "T", "N8", "WILD"],
  ["K", "Q", "J", "STAR", "N9", "A", "WILD", "T", "N8", "Q", "K", "J", "A", "STAR", "T", "N9", "N8", "Q", "K", "A", "J", "T", "N8", "WILD"],
  ["Q", "J", "T", "A", "N8", "K", "STAR", "WILD", "N9", "J", "Q", "T", "A", "K", "N8", "STAR", "N9", "J", "Q", "A", "T", "K", "N8", "WILD"],
  ["J", "T", "N9", "K", "A", "STAR", "Q", "N8", "WILD", "T", "J", "N9", "K", "A", "Q", "STAR", "N8", "T", "J", "K", "A", "Q", "N9", "WILD"],
  ["T", "N9", "N8", "A", "J", "K", "Q", "STAR", "WILD", "N9", "T", "N8", "A", "J", "K", "Q", "STAR", "N9", "T", "A", "J", "K", "N8", "WILD"],
];

export const REEL_STRIPS = STRIPS;

export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function symbolAt(strip: readonly string[], index: number): string {
  return strip[wrapIndex(index, strip.length)] ?? "";
}

export function windowAt(strip: readonly string[], stopIndex: number, rows = VISIBLE_ROWS): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows; i++) out.push(symbolAt(strip, stopIndex + i));
  return out;
}

export function window3(strip: readonly string[], stop: number): [string, string, string] {
  return [symbolAt(strip, stop), symbolAt(strip, stop + 1), symbolAt(strip, stop + 2)];
}

export function cryptoHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export class ReelStrip {
  constructor(public readonly symbols: readonly string[]) {}
  at(stop: number, rows = 3): string[] {
    return windowAt(this.symbols, stop, rows);
  }
}
