import { useCallback, useEffect, useRef, useState } from "react";
import { transcriptOf, voiceError } from "@/lib/bot/voice";

/** The parts of the browser's SpeechRecognition used here: not in TypeScript's own types. */
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Speaking a message (`voice.ts`): while it listens, `onText` gets all that
 * has been said so far, each time more is heard. `supported` is false where
 * the browser has no speech recognition: the microphone is then not shown.
 */
export function useVoice(onText: (spoken: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  /** Sent, or thrown away: what is still heard after it is not wanted. */
  const muted = useRef(false);
  const latest = useRef(onText);
  latest.current = onText;

  // Known after the page has loaded, so the server's page and the browser's agree.
  useEffect(() => setSupported(recognitionClass() !== null), []);
  // Leaving: the microphone is let go.
  useEffect(() => () => rec.current?.abort(), []);

  /** Stops listening; what was said until then still arrives. */
  const stop = useCallback(() => rec.current?.stop(), []);
  /** Stops listening, and nothing more that was heard arrives: the message went. */
  const cancel = useCallback(() => {
    muted.current = true;
    rec.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Class = recognitionClass();
    if (!Class || rec.current) return;
    const r = new Class();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event) => {
      if (!muted.current) latest.current(transcriptOf(event.results));
    };
    r.onerror = (event) => setError(voiceError(event.error));
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    setError(null);
    muted.current = false;
    try {
      r.start();
      rec.current = r;
      setListening(true);
    } catch {
      setError(voiceError(""));
    }
  }, []);

  return { supported, listening, error, start, stop, cancel };
}
