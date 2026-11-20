/**
 * Pictures and text files attached to a message to the person's own bot,
 * as Grok takes them. Pictures go as images (`agent/images.ts`, resized in
 * the browser first); a text file goes as text, inside the message. Both
 * are read with the message they came with: later turns carry a note that
 * they were attached, so a long chat does not resend them every time.
 * Pure, for tests.
 */

export type ChatFile = { name: string; text: string };

/** Text files to a message at most, the characters of one, and of all. */
export const FILE_LIMITS = { files: 3, chars: 20_000, total: 40_000 } as const;

/** What the file picker offers: pictures, and files that are text. */
export const ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,.txt,.md,.csv,.tsv,.json,.yaml,.yml,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.kt,.swift,.c,.h,.cpp,.cs,.php,.sh,.sql,.toml,.ini,.log,.env.example";

const TEXT_NAME =
  /\.(txt|md|markdown|csv|tsv|json|ya?ml|xml|html?|css|jsx?|tsx?|mjs|cjs|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|sql|toml|ini|log|example)$/i;

/** A file that is read as text: by its type, or by its name when the browser gives none. */
export function isTextFile(name: string, type: string): boolean {
  if (type.startsWith("text/")) return true;
  if (/^application\/(json|xml|x-yaml|yaml|javascript|typescript|sql|x-sh)/.test(type)) return true;
  return TEXT_NAME.test(name);
}

/** A picture the chat sends as an image. */
export function isPicture(type: string): boolean {
  return /^image\/(png|jpeg|webp|gif)$/.test(type);
}

/** A file's name as it is shown and sent: one line, cut short. */
export function fileName(raw: string): string {
  const name = raw.replace(/[\r\n\t]+/g, " ").trim() || "file";
  return name.length <= 80 ? name : `${name.slice(0, 79)}…`;
}

/** The text files of a request, checked; an error says what is wrong in words for the person. */
export function validFiles(raw: unknown): { files: ChatFile[] } | { error: string } {
  if (raw === undefined || raw === null) return { files: [] };
  if (!Array.isArray(raw)) return { error: "The files could not be read." };
  if (raw.length > FILE_LIMITS.files)
    return { error: `Attach at most ${FILE_LIMITS.files} files to a message.` };
  const files: ChatFile[] = [];
  let total = 0;
  for (const row of raw) {
    const file = row as Partial<ChatFile> | null;
    if (!file || typeof file.name !== "string" || typeof file.text !== "string")
      return { error: "The files could not be read." };
    if (file.text.length > FILE_LIMITS.chars)
      return { error: `${fileName(file.name)} is too long. Attach a shorter file.` };
    total += file.text.length;
    files.push({ name: fileName(file.name), text: file.text });
  }
  if (total > FILE_LIMITS.total)
    return { error: "Those files are too long together. Attach fewer." };
  return { files };
}

/** A fence longer than any run of backticks in the text, so the file cannot close it early. */
function fenceFor(text: string): string {
  const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(longest + 1);
}

/**
 * The message as the model reads it, with its text files: each after the
 * person's words, fenced, under its name. What a file says is the person's
 * material to work on, not instructions to the bot.
 */
export function withFiles(text: string, files: ChatFile[]): string {
  if (files.length === 0) return text;
  const blocks = files.map((file) => {
    const fence = fenceFor(file.text);
    return `Attached file "${file.name}":\n${fence}\n${file.text}\n${fence}`;
  });
  return [text.trim() || "Look at the attached file.", ...blocks].join("\n\n");
}

/** What a later turn says in place of what was attached to it. */
export function attachedNote(names: string[]): string {
  if (names.length === 0) return "";
  return names.length === 1
    ? `[They attached ${names[0]}]`
    : `[They attached ${names.length} files: ${names.join(", ")}]`;
}

/** A message from the history as the model reads it: its words, and a note of what came with it. */
export function turnWithNote(text: string, names: string[] | undefined): string {
  const note = attachedNote(names ?? []);
  return note ? `${text}${text ? "\n" : ""}${note}` : text;
}
