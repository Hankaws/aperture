import { Mic, MicOff } from "lucide-react";
import { VOICE_NOTE } from "@/lib/bot/voice";
import { cn } from "@/lib/utils";

/**
 * The microphone beside a chat's send button, as Grok has: press to speak,
 * press again (or send) to stop. Not shown where the browser cannot listen.
 */
export function VoiceButton({
  voice,
  onStart,
  disabled = false,
}: {
  voice: { supported: boolean; listening: boolean; start: () => void; stop: () => void };
  /** Just before it listens: what is typed so far is kept, and what is said goes after it. */
  onStart: () => void;
  disabled?: boolean;
}) {
  if (!voice.supported) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (voice.listening) voice.stop();
        else {
          onStart();
          voice.start();
        }
      }}
      disabled={disabled && !voice.listening}
      aria-pressed={voice.listening}
      aria-label={voice.listening ? "Stop listening" : "Speak your message"}
      title={voice.listening ? "Listening… press to stop" : VOICE_NOTE}
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40",
        voice.listening
          ? "bg-danger/15 text-danger ring-2 ring-danger/40"
          : "text-muted hover:bg-elevated hover:text-fg",
      )}
    >
      {voice.listening && (
        <span
          className="absolute inset-0 rounded-full ring-2 ring-danger/30 motion-safe:animate-ping"
          aria-hidden
        />
      )}
      {voice.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
    </button>
  );
}
