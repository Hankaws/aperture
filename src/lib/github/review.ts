import type { ProposedEdit } from "../workspace/types";

export type GithubReviewComment = {
  path: string;
  line: number;
  side: "RIGHT";
  body: string;
};

export type GithubReview = {
  body: string;
  comments: GithubReviewComment[];
};

function lineOf(text: string, excerpt: string): number | null {
  const needle = excerpt.trim();
  if (needle.length < 2) return null;
  const lines = text.split("\n");
  const index = lines.findIndex((line) => line.includes(needle));
  return index >= 0 ? index + 1 : null;
}

/** Pending review notes, as a GitHub pull request review. Null when there is nothing to say. */
export function githubReview(edits: ProposedEdit[]): GithubReview | null {
  const lines: string[] = [];
  const comments: GithubReviewComment[] = [];
  for (const edit of edits) {
    if (edit.status !== "pending" || !edit.notes?.length) continue;
    for (const note of edit.notes) {
      const text = note.text.replace(/\s+/g, " ").trim().slice(0, 400);
      if (text.length < 4) continue;
      const sure = typeof note.confidence === "number" ? ` (${Math.round(note.confidence * 100)})` : "";
      const line = lineOf(edit.newText, note.excerpt);
      lines.push(line ? `${edit.path}:${line}${sure} ${text}` : `${edit.path}${sure} ${text}`);
      if (!line) continue;
      if (comments.some((row) => row.path === edit.path && row.line === line && row.body === text)) continue;
      comments.push({ path: edit.path, line, side: "RIGHT", body: text });
    }
  }
  if (lines.length === 0) return null;
  return {
    body: ["Aperture review. A comment only where something looks wrong.", "", ...lines.slice(0, 20).map((line) => `- ${line}`)]
      .join("\n")
      .slice(0, 6000),
    comments: comments.slice(0, 20),
  };
}
