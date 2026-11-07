import { MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentQuestion } from "@/lib/agent/ask";

/**
 * A question the agent stopped to ask (`ask_user`), under its reply. Each
 * answer sends itself as the next message; any other answer can be typed
 * below. Once answered, or while a turn runs, the answers are only shown.
 */
export function QuestionCard({
  question,
  answerable,
  onAnswer,
}: {
  question: AgentQuestion;
  answerable: boolean;
  onAnswer: (text: string) => void;
}) {
  const options = Array.isArray(question.options) ? question.options : [];
  return (
    <div
      className="mt-2 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2"
      role="group"
      aria-label="The agent asks"
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
        <MessageCircleQuestion className="size-3.5" aria-hidden />
        Needs your answer
      </p>
      <p className="mt-1 text-sm text-pretty text-fg">{question.text}</p>
      {options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant="outline"
              disabled={!answerable}
              onClick={() => onAnswer(option)}
              className="h-auto max-w-full py-1 text-left whitespace-normal"
            >
              {option}
            </Button>
          ))}
        </div>
      )}
      {answerable && (
        <p className="mt-2 text-xs text-subtle">
          {options.length > 0 ? "Or type a different answer below." : "Type your answer below."}
        </p>
      )}
    </div>
  );
}
