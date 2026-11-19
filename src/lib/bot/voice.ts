/**
 * Talking to a bot instead of typing, as Grok lets you: the browser's own
 * speech recognition turns what is said into the message box's text, which
 * the person reads and sends. Where the browser does the recognizing is its
 * own: Chrome sends the voice to Google's speech service, Safari to Apple's.
 * Pure, for tests: the browser side is `use-voice.ts`.
 */

/** What is said, after what was already typed: one space between, none doubled. */
export function joinDraft(typed: string, spoken: string): string {
  const said = spoken.replace(/\s+/g, " ").trim();
  if (!said) return typed;
  const before = typed.replace(/\s+$/, "");
  return before ? `${before} ${said}` : said;
}

/** Each result's best guess, in order, as one line. */
export function transcriptOf(results: ArrayLike<ArrayLike<{ transcript: string }>>): string {
  const parts: string[] = [];
  for (let i = 0; i < results.length; i++) parts.push(results[i]?.[0]?.transcript ?? "");
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** What the box says when the browser's recognition stops on an error; null when it is no fault. */
export function voiceError(code: string): string | null {
  switch (code) {
    case "aborted":
      return null;
    case "no-speech":
      return "Didn't hear anything. Press the microphone and speak.";
    case "not-allowed":
    case "service-not-allowed":
      return "The microphone is blocked. Allow it for this site in your browser to talk.";
    case "audio-capture":
      return "No microphone found.";
    case "network":
      return "Your browser's speech recognition needs a connection.";
    case "language-not-supported":
      return "Your browser can't recognize speech in this language.";
    default:
      return "Speech recognition stopped. Try again.";
  }
}

/** What the microphone button says about where the voice goes. */
export const VOICE_NOTE =
  "Speak your message. Your browser turns it into text (Chrome uses Google's speech service, Safari Apple's); you read it before you send.";
