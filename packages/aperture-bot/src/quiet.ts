/**
 * Text the bot did not write itself (the model's words, an issue's title, a
 * compiler's message), made safe to post: an @mention would notify whoever it
 * names, so a stranger's issue could make the bot ping anyone; and an
 * unclosed `<!--` would hide the rest of the bot's comment, its boxes too.
 *
 * A zero-width space after the `@` and inside `<!--` keeps both visible but
 * inert. Email addresses are left as they are. Pure, for tests.
 */
const ZWSP = "\u200b";

/** The text with every @mention and HTML comment opener made inert. */
export function quiet(text: string): string {
  return text
    .replace(/(^|[^\w@`/.\u200b])@(?=[A-Za-z0-9])/g, `$1@${ZWSP}`)
    .replace(/<!--/g, `<${ZWSP}!--`);
}
