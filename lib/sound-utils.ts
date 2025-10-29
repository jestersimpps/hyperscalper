let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

type SoundStyle = 'standard' | 'cloud' | 'big';

export async function playNotificationSound(
  signalType: 'bullish' | 'bearish' = 'bullish',
  style: SoundStyle = 'standard'
): Promise<void> {
  try {
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const frequency = signalType === 'bullish' ? 800 : 600;

    if (style === 'cloud') {
      for (let i = 0; i < 5; i++) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
        oscillator.type = 'sine';

        const startTime = ctx.currentTime + i * 0.08;
        gainNode.gain.setValueAtTime(0.4, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.06);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.06);
      }
      console.log(`Playing ${signalType} cloud sound (5 beeps) at ${frequency}Hz`);
    } else if (style === 'big') {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.6);

      console.log(`Playing ${signalType} big order sound (long) at ${frequency}Hz`);
    } else {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);

      console.log(`Playing ${signalType} standard sound at ${frequency}Hz`);
    }
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
}
