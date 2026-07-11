// Source: packages/shared/src/middleware/auth.ts (lines 13-26)
// Listing id: timing-safe-equal
// Caption: Constant-time string comparison for API keys
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  // Manual byte-by-byte XOR comparison for timing-safe comparison
  // This is the same approach used by crypto.timingSafeEqual but manually
  // implemented to avoid TypeScript typing issues with the global crypto type.
  let result = 0;
  for (let i = 0; i < aBuf.length; i++) {
    result |= aBuf[i] ^ bBuf[i];
  }
  return result === 0;
}
