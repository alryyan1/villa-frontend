// Plays a short C-E-G ascending chime using the Web Audio API.
// No files, no dependencies — works in all modern browsers.
export function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // C5 → E5 → G5  (major triad arpeggio)
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.start(t);
      osc.stop(t + 0.45);
    });
  } catch {
    // AudioContext blocked (e.g. no user gesture yet) — fail silently
  }
}
