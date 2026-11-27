import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { parsePullLink, pullLinkPath } from "@/lib/github/pull-link";

/**
 * The shortest way to a first result: paste a pull request's link under the hero and land on
 * its check. The check page does the reading; this only turns the link into its address.
 */
export function HeroCheck() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-6 flex w-full max-w-2xl flex-col gap-2 sm:flex-row"
      data-hero-check
      onSubmit={(event) => {
        event.preventDefault();
        const link = parsePullLink(text);
        if (!link) {
          setError("Paste a pull request's link, like https://github.com/owner/repo/pull/12.");
          return;
        }
        void navigate({ to: "/check", search: { pr: pullLinkPath(link) } });
      }}
    >
      <label htmlFor="hero-pull-link" className="sr-only">
        Pull request link to check
      </label>
      <input
        id="hero-pull-link"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        placeholder="Paste a pull request link"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "hero-pull-link-error" : undefined}
        className="h-11 w-full min-w-0 rounded-lg border border-border bg-elevated px-3 font-mono text-sm text-fg placeholder:text-subtle focus:border-accent/60 focus:outline-none sm:flex-1"
      />
      <Button type="submit" size="lg" className="h-11" disabled={!text.trim()}>
        Check it
      </Button>
      {error && (
        <p id="hero-pull-link-error" role="alert" className="text-sm text-danger sm:basis-full">
          {error}
        </p>
      )}
    </form>
  );
}
