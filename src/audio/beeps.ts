function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** Tiny PCM WAV data URI. Phaser Web Audio consumes this; HTML5 Audio is not primary. */
export function beepDataUri(freq: number, ms: number, volume = 0.28): string {
  const sampleRate = 22050;
  const n = Math.max(1, Math.floor((sampleRate * ms) / 1000));
  const dataSize = n * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < n; i += 1) {
    const t = i / sampleRate;
    const env = Math.min(1, i / 180) * Math.min(1, (n - i) / 280);
    const sample = Math.sin(2 * Math.PI * freq * t) * volume * env;
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true);
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return `data:audio/wav;base64,${btoa(bin)}`;
}

export const SFX_URIS = {
  spin: beepDataUri(196, 90),
  stop: beepDataUri(392, 55),
  win: beepDataUri(660, 180),
  click: beepDataUri(330, 40),
};
