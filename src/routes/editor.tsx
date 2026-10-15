import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { EDITOR_FEATURES, type EditorFeature } from "@/components/site/editor-features";

export const Route = createFileRoute("/editor")({ head: () => pageHead("editor"), component: EditorTour });

function Feature({ feature }: { feature: EditorFeature }) {
  return (
    <li className="min-w-0 border-t border-border py-6">
      <kbd className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-xs text-muted">
        {feature.key}
      </kbd>
      <h3 className="mt-3 text-xl font-medium tracking-tight">{feature.title}</h3>
      <p className="mt-2 max-w-prose text-base leading-relaxed text-muted">{feature.body}</p>
      {feature.shot && (
        <img
          src={feature.shot.src}
          alt={feature.shot.alt}
          loading="lazy"
          className="mt-5 w-full rounded-xl border border-border"
        />
      )}
    </li>
  );
}

/**
 * The editor's TypeScript help, one feature at a time, with its key. The list
 * is shared with the landing page's Editor section (editor-features.ts).
 */
function EditorTour() {
  const withShot = EDITOR_FEATURES.filter((f) => f.shot);
  const rest = EDITOR_FEATURES.filter((f) => !f.shot);
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-4 pt-12 pb-20 sm:px-5 sm:pt-20">
        <h1 className="max-w-3xl text-[clamp(2.8rem,7vw,5rem)] leading-[0.92] font-medium tracking-[-0.03em] text-balance">
          The editor knows your code.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-pretty text-muted">
          Aperture runs the TypeScript compiler in your browser tab, the same one that checks every
          change before you apply it. It loads the first time you type in a file. Nothing is
          installed and nothing is sent anywhere.
        </p>
        <Link to="/app" className="mt-8 inline-block text-lg text-fg">
          Try it on the demo project →
        </Link>

        <ul className="mt-14" aria-label="Shown">
          {withShot.map((feature) => (
            <Feature key={feature.key} feature={feature} />
          ))}
        </ul>
        <ul className="grid gap-x-10 sm:grid-cols-2" aria-label="And more">
          {rest.map((feature) => (
            <Feature key={feature.key} feature={feature} />
          ))}
        </ul>

        <section className="mt-12 rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-2xl font-medium tracking-tight">
            The same compiler checks the model.
          </h2>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
            When the model proposes a change, Types runs this compiler on it before you can press
            Apply, and the agent can ask it where a name is used before it changes one.
          </p>
          <Link to="/benchmark" className="mt-5 inline-block text-fg">
            What the checks catch →
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
