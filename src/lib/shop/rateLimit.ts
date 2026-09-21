/**
 * Reading a 429 the way a person needs it read.
 *
 * A throttled request is not a failed one — the order exists, the credential
 * was right, the caller simply asked too often. Telling them "order not found"
 * (which is what every one of these pages did, because they branched on
 * `!res.ok` alone) sends a customer off to hunt for a mistake they did not
 * make.
 */

/** Seconds to wait, from whatever the server said, clamped to something sane. */
export function retryAfterSeconds(res: Response): number {
  // `@nestjs/throttler` names its header after the bucket
  // (`Retry-After-default`), so the bare name is not always there.
  let raw = res.headers.get("retry-after");
  if (!raw) {
    for (const [name, value] of res.headers.entries()) {
      if (name.toLowerCase().startsWith("retry-after")) {
        raw = value;
        break;
      }
    }
  }
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return 60;
  // A server that says "come back in an hour" is still telling a person to
  // wait, and a countdown in hours reads as broken. Cap what we show.
  return Math.min(Math.ceil(seconds), 15 * 60);
}

/** "in 45 seconds" / "in 3 minutes", in the page's own words. */
export function formatRetryAfter(seconds: number, t: { retrySeconds: string; retryMinutes: string }): string {
  if (seconds < 60) return t.retrySeconds.replace("{n}", String(seconds));
  return t.retryMinutes.replace("{n}", String(Math.ceil(seconds / 60)));
}

export function isRateLimited(res: Response | null | undefined): boolean {
  return res?.status === 429;
}
