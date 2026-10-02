/** One lesson per Composer turn, kept in the project so the next run can follow it. */

export const LESSONS_PATH = ".aperture/lessons.md";
const MAX_LESSONS = 12;

export type LessonScore = "up" | "down";

type Lesson = { id: string; score: LessonScore; line: string };

function parseLessons(text: string): Lesson[] {
  const lessons: Lesson[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const mark = /^<!-- lesson (\S+) (up|down) -->$/.exec(lines[i]?.trim() ?? "");
    if (!mark) continue;
    const body = lines[i + 1]?.trim() ?? "";
    if (!body.startsWith("- ")) continue;
    lessons.push({ id: mark[1]!, score: mark[2] as LessonScore, line: body.slice(2).trim() });
  }
  return lessons;
}

function renderLessons(lessons: Lesson[]): string {
  const body = lessons
    .map((lesson) => `<!-- lesson ${lesson.id} ${lesson.score} -->\n- ${lesson.line}`)
    .join("\n\n");
  return `# Lessons\n\n${body}\n`;
}

export function upsertLesson(text: string, id: string, score: LessonScore, line: string): string {
  const clean = line.replace(/\s+/g, " ").trim().slice(0, 240);
  const lessons = parseLessons(text).filter((lesson) => lesson.id !== id);
  lessons.push({ id, score, line: clean });
  return renderLessons(lessons.slice(-MAX_LESSONS));
}

export function removeLesson(text: string, id: string): string {
  const lessons = parseLessons(text).filter((lesson) => lesson.id !== id);
  if (lessons.length === 0) return "";
  return renderLessons(lessons);
}

export function lessonAfterKeep(
  lessonsText: string,
  detail: string | null | undefined,
  id: string,
  opts: { keepingLessons: boolean; alreadyPending: boolean },
): { id: string; path: string; oldText: string; newText: string; description: string } | null {
  if (opts.keepingLessons || opts.alreadyPending || !detail) return null;
  return lessonEditForFailure(lessonsText, detail, id);
}

export function ruleFromFailure(detail: string): string | null {
  const line = detail.replace(/\s+/g, " ").trim();
  if (line.length < 8) return null;
  const lower = line.toLowerCase();
  if (/type error|types failed|is not assignable|cannot find name/.test(lower)) {
    return "Match the declared type before you stage.";
  }
  if (/renders blank|did not finish loading/.test(lower)) {
    return "Do not stage a page that renders blank or fails to load.";
  }
  if (/npm run|tests? fail/.test(lower)) {
    return "Run the tests and fix a new failure before you call it done.";
  }
  if (/import|cannot find module|failed to resolve/.test(lower)) {
    return "Only import a file that exists in this project.";
  }
  if (/parse|syntax|unexpected token/.test(lower)) {
    return "Make the file parse before you stage it.";
  }
  return "Fix the failing check before you stage, and do not call it done while it is red.";
}

export function lessonEditForFailure(
  lessonsText: string,
  detail: string,
  id: string,
): { id: string; path: string; oldText: string; newText: string; description: string } | null {
  const line = ruleFromFailure(detail);
  if (!line) return null;
  const covered = lessonsForPrompt(lessonsText).toLowerCase();
  if (covered.includes(line.toLowerCase().slice(0, 48))) return null;
  return {
    id,
    path: LESSONS_PATH,
    oldText: lessonsText,
    newText: upsertLesson(lessonsText, id, "down", line),
    description: "Remember this rule",
  };
}

/** Bullets only. The markers stay in the file so a lesson can be removed later. */
export function lessonsForPrompt(text: string): string {
  return parseLessons(text)
    .map((lesson) => `- ${lesson.line}`)
    .join("\n");
}

export type ObservationMessage = {
  id: string;
  role: string;
  lesson?: LessonScore;
  verify?: { status: string; detail: string } | null;
};

function coveredByLessons(texts: string[], line: string): boolean {
  const needle = line.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 48);
  if (needle.length < 8) return false;
  const blob = texts.map((text) => lessonsForPrompt(text)).join("\n").toLowerCase();
  return blob.includes(needle);
}

/**
 * Recent misses and failed checks. Worked lessons stay in the lessons file.
 * A failure already written, or already staged on .aperture/lessons.md, is left out.
 */
export function formatObservations(messages: ObservationMessage[], lessonsText: string, pendingLessons: string[] = []): string {
  const byId = new Map(parseLessons(lessonsText).map((lesson) => [lesson.id, lesson]));
  const known = [lessonsText, ...pendingLessons];
  const lines: string[] = [];
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const lesson = message.lesson ? byId.get(message.id) : undefined;
    if (lesson?.score === "down") lines.push(`- missed: ${lesson.line}`);
    const detail = message.verify?.status === "failed" ? message.verify.detail.replace(/\s+/g, " ").trim() : "";
    const rule = detail ? ruleFromFailure(detail) : null;
    if (detail && !coveredByLessons(known, detail) && !(rule && coveredByLessons(known, rule))) {
      lines.push(`- checks failed: ${detail.slice(0, 180)}`);
    }
  }
  const recent = lines.slice(-8);
  if (recent.length === 0) return "";
  return [
    "Observations from earlier turns. If a line below is not already in the lessons, propose one search/replace that adds it to .aperture/lessons.md. If it is already there, follow it and do not add it again.",
    ...recent,
  ].join("\n");
}

export type StandingRule = { id: string; line: string };

const STANDING_KEY = "aperture-standing";
const MAX_STANDING = 8;
const standingListeners = new Set<() => void>();

export function normalizeStanding(raw: unknown): StandingRule[] {
  if (!Array.isArray(raw)) return [];
  const out: StandingRule[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id.trim().slice(0, 80) : "";
    const line = typeof rec.line === "string" ? rec.line.replace(/\s+/g, " ").trim().slice(0, 240) : "";
    if (!id || line.length < 8) continue;
    if (out.some((rule) => rule.id === id || rule.line.toLowerCase() === line.toLowerCase())) continue;
    out.push({ id, line });
  }
  return out.slice(-MAX_STANDING);
}

export function upsertStanding(rules: StandingRule[], id: string, line: string): StandingRule[] {
  const clean = line.replace(/\s+/g, " ").trim().slice(0, 240);
  if (!id.trim() || clean.length < 8) return rules;
  const next = rules.filter((rule) => rule.id !== id && rule.line.toLowerCase() !== clean.toLowerCase());
  next.push({ id, line: clean });
  return next.slice(-MAX_STANDING);
}

export function dropStanding(rules: StandingRule[], id: string): StandingRule[] {
  return rules.filter((rule) => rule.id !== id);
}

export function standingForPrompt(rules: StandingRule[]): string {
  return rules.map((rule) => `- ${rule.line}`).join("\n");
}

export function readStanding(): StandingRule[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeStanding(JSON.parse(window.localStorage.getItem(STANDING_KEY) || "[]"));
  } catch {
    return [];
  }
}

function writeStanding(rules: StandingRule[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STANDING_KEY, JSON.stringify(rules));
  for (const listener of standingListeners) listener();
}

export function saveStanding(id: string, line: string) {
  writeStanding(upsertStanding(readStanding(), id, line));
}

export function clearStanding(id: string) {
  writeStanding(dropStanding(readStanding(), id));
}

export function subscribeStanding(listener: () => void) {
  standingListeners.add(listener);
  return () => standingListeners.delete(listener);
}
