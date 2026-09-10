/**
 * Network Time Synchronization Engine
 * Compensates for clock skew between client hardware clocks and the Cloud Run server clock.
 * Prevents timer discrepancy / drift between projector displays, operator views, and backend.
 */

let serverTimeOffsetMs = 0;
let hasCalibrated = false;
let isCalibrating = false;

// Listeners to notify components when calibration adjusts the clock offset
type OffsetListener = (offsetMs: number) => void;
const listeners = new Set<OffsetListener>();

export function subscribeTimeSync(listener: OffsetListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns the estimated current timestamp on the server (in ms).
 */
export function getServerNow(): number {
  return Date.now() + serverTimeOffsetMs;
}

/**
 * Returns the current calculated clock offset in ms (serverTime - clientTime).
 */
export function getServerTimeOffset(): number {
  return serverTimeOffsetMs;
}

/**
 * Is clock offset calibrated at least once.
 */
export function isClockCalibrated(): boolean {
  return hasCalibrated;
}

/**
 * Update the offset using a sample timestamp from the server.
 * @param serverTime Server timestamp in ms
 * @param rttMs Estimated network round-trip time in ms
 */
export function recordServerTimestamp(serverTime: number, rttMs: number = 0): void {
  if (!serverTime || isNaN(serverTime)) return;

  // Midpoint estimate: server time corresponds to clientTime - rtt / 2
  const now = Date.now();
  const halfRtt = Math.max(0, Math.min(1000, Math.round(rttMs / 2)));
  const estimatedServerTimeAtNow = serverTime + halfRtt;
  const newOffset = estimatedServerTimeAtNow - now;

  if (!hasCalibrated) {
    serverTimeOffsetMs = newOffset;
    hasCalibrated = true;
  } else {
    // Smooth the offset using exponential moving average to eliminate network jitter
    // If discrepancy is large (> 2 seconds), adopt new offset faster
    const diff = Math.abs(newOffset - serverTimeOffsetMs);
    const alpha = diff > 2000 ? 0.8 : 0.3;
    serverTimeOffsetMs = Math.round(serverTimeOffsetMs * (1 - alpha) + newOffset * alpha);
  }

  listeners.forEach((fn) => {
    try {
      fn(serverTimeOffsetMs);
    } catch {
      // ignore listener error
    }
  });
}

/**
 * Explicitly calibrate client clock against server /api/time.
 * Performs quick samples and selects the lowest RTT sample for maximum accuracy.
 */
export async function syncServerTime(): Promise<number> {
  if (isCalibrating) return serverTimeOffsetMs;
  isCalibrating = true;

  try {
    const samples: { offset: number; rtt: number }[] = [];

    // Take 2 quick samples to find the lowest-latency request
    for (let i = 0; i < 2; i++) {
      const t0 = Date.now();
      const res = await fetch('/api/time', { cache: 'no-store' });
      const t1 = Date.now();
      if (res.ok) {
        const data = await res.json();
        const rtt = Math.max(1, t1 - t0);
        const serverTime = data.serverTime;
        const estServerTime = serverTime + Math.round(rtt / 2);
        const offset = estServerTime - t1;
        samples.push({ offset, rtt });
      }
      // Small pause between samples if repeating
      if (i === 0) await new Promise((r) => setTimeout(r, 40));
    }

    if (samples.length > 0) {
      // Sort by RTT ascending, pick sample with minimum latency
      samples.sort((a, b) => a.rtt - b.rtt);
      const best = samples[0];
      if (!hasCalibrated) {
        serverTimeOffsetMs = best.offset;
        hasCalibrated = true;
      } else {
        const diff = Math.abs(best.offset - serverTimeOffsetMs);
        const alpha = diff > 2000 ? 0.8 : 0.3;
        serverTimeOffsetMs = Math.round(serverTimeOffsetMs * (1 - alpha) + best.offset * alpha);
      }

      listeners.forEach((fn) => {
        try {
          fn(serverTimeOffsetMs);
        } catch {
          // ignore
        }
      });
    }
  } catch (err) {
    console.warn('Clock synchronization query failed:', err);
  } finally {
    isCalibrating = false;
  }

  return serverTimeOffsetMs;
}

// Auto-start synchronization in browser environment
if (typeof window !== 'undefined') {
  // Initial sync immediately
  syncServerTime();

  // Periodic resync every 15 seconds to stay calibrated
  setInterval(() => {
    syncServerTime();
  }, 15000);

  // Resync when window gains focus or device wakes from sleep
  window.addEventListener('focus', () => {
    syncServerTime();
  });
}
