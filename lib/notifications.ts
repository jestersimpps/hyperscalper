let originalTitle: string | null = null;
let flashIntervalId: ReturnType<typeof setInterval> | null = null;
let flashBaseText: string | null = null;
let visibilityHandlerAttached = false;

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

interface ScanNotificationInput {
  symbol: string;
  signalType: 'bullish' | 'bearish';
}

export function showScanNotification(results: ScanNotificationInput[]): void {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  if (!document.hidden) {
    return;
  }

  if (results.length === 0) {
    return;
  }

  const first = results[0];
  const count = results.length;
  const title = count === 1
    ? `${first.symbol} — ${first.signalType === 'bullish' ? 'BULL' : 'BEAR'} signal`
    : `${count} signals — ${first.symbol} and ${count - 1} more`;

  const body = results
    .slice(0, 5)
    .map(r => `${r.symbol} ${r.signalType === 'bullish' ? '↑' : '↓'}`)
    .join('  ·  ');

  try {
    const notification = new Notification(title, {
      body,
      tag: 'hyperscalper-scan',
      silent: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // noop - some browsers throw if constructed in the wrong context
  }
}

export function flashTitle(text: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (flashIntervalId) {
    clearInterval(flashIntervalId);
  }

  if (originalTitle === null) {
    originalTitle = document.title;
  }

  flashBaseText = text;
  let showing = true;

  flashIntervalId = setInterval(() => {
    document.title = showing ? (flashBaseText ?? text) : (originalTitle ?? '');
    showing = !showing;
  }, 1000);

  if (!visibilityHandlerAttached) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        stopTitleFlash();
      }
    });
    visibilityHandlerAttached = true;
  }
}

export function stopTitleFlash(): void {
  if (flashIntervalId) {
    clearInterval(flashIntervalId);
    flashIntervalId = null;
  }

  if (originalTitle !== null) {
    document.title = originalTitle;
    originalTitle = null;
  }

  flashBaseText = null;
}
