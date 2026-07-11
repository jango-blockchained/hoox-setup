// Source: workers/agent-worker/src/logic/prompt-sanitizer.ts (lines 46-59)
// Listing id: prompt-sanitizer
// Caption: LLM prompt-injection marker detection
export function sanitizeLogMessage(raw: unknown): string {
  if (raw == null) return "";
  let s = String(raw);
  // Strip ASCII control chars and the C1 unicode control range.
  // Keeps \n (0x0A) and \t (0x09) which are common in logs.
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
  if (s.length > MAX_LOG_MESSAGE_LENGTH) {
    s = s.slice(0, MAX_LOG_MESSAGE_LENGTH) + "...";
  }
  for (const re of INJECTION_MARKERS) {
    if (re.test(s)) return DROPPED_SENTINEL;
  }
  return s;
