import { Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { inlineParts, parseChangelog, sectionLabel } from "@/lib/changelog";
import source from "../../CHANGELOG.md?raw";

export const Route = createFileRoute("/changelog")({ component: ChangelogPage });

const log = parseChangelog(source);
// Unreleased is empty right after a release; a heading with nothing under it says nothing.
const sections = log.sections.filter((section) => section.groups.length > 0);
const anchor = (title: string) => `changes-${title.replace(/[^\w.-]+/g, "-")}`;
const FILE_URL = "https://github.com/Hankaws/aperture/blob/main/CHANGELOG.md";

function Rich({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((part, i) => {
        if (part.kind === "bold")
          return (
            <strong key={i} className="font-medium text-fg">
              {part.text}
            </strong>
          );
        if (part.kind === "code")
          return (
            <code key={i} className="font-mono text-[0.9em] text-fg">
              {part.text}
            </code>
          );
        if (part.kind === "link")
          return (
            <a key={i} href={part.href} className="text-fg underline-offset-2 hover:underline">
              {part.text}
            </a>
          );
        return <Fragment key={i}>{part.text}</Fragment>;
      })}
    </>
  );
}

const GROUP_TONE: Record<string, string> = {
  Added: "text-ok",
  Changed: "text-accent",
  Fixed: "text-warn",
};

function ChangelogPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Changelog</p>
        <h1 className="mt-4 text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          What changed in Aperture
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-pretty text-muted">
          Newest first. Each line links the pull request it came from. The same list is{" "}
          <a href={FILE_URL} className="text-fg underline-offset-2 hover:underline">
            CHANGELOG.md
          </a>{" "}
          in the repository.
        </p>

        <ol className="mt-10 space-y-12">
          {sections.map((section) => (
            <li key={section.title} aria-labelledby={anchor(section.title)}>
              <h2 id={anchor(section.title)} className="text-lg font-medium tracking-tight">
                {sectionLabel(section.title)}
              </h2>
              {section.groups.map((group) => (
                <section
                  key={group.title}
                  className="mt-4"
                  aria-label={`${sectionLabel(section.title)}: ${group.title}`}
                >
                  <h3
                    className={`text-[0.7rem] font-medium tracking-[0.14em] uppercase ${GROUP_TONE[group.title] ?? "text-subtle"}`}
                  >
                    {group.title}
                  </h3>
                  <ul className="mt-2 space-y-2 border-l border-border pl-4">
                    {group.items.map((item, i) => (
                      <li key={i} className="text-sm leading-relaxed text-pretty text-muted">
                        <Rich text={item} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </li>
          ))}
        </ol>

        <p className="mt-12 text-sm text-muted">
          <Link to="/app" className="text-fg underline-offset-2 hover:underline">
            Try it in the editor
          </Link>{" "}
          · no key needed for the demo.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
