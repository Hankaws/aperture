/**
 * What the editor knows about TypeScript, with the key for each: the landing
 * page's Editor section and the /editor tour list the same things. Keep the
 * keys in step with the editor's own help (overlays.tsx).
 */
export type EditorFeature = {
  key: string;
  title: string;
  body: string;
  /** A screenshot on the tour, from scripts/editor-shots.mjs. */
  shot?: { src: string; alt: string };
};

export const EDITOR_FEATURES: EditorFeature[] = [
  {
    key: "Hover",
    title: "Types on hover",
    body: "Rest on a name to see its type and its doc comment.",
  },
  {
    key: "( and ,",
    title: "Parameter hints",
    body: "Inside a call, the function's parameters sit above it, with the one you are typing underlined.",
    shot: {
      src: "/editor/hints.jpg",
      alt: "The editor showing listTasks(page: number, pageSize: number): Task[] above a call, with pageSize underlined",
    },
  },
  {
    key: "Typing",
    title: "Completions that know the types",
    body: "After a dot, only what that value has. Imports and names from every file.",
  },
  {
    key: "F12",
    title: "Go to definition",
    body: "F12 or Ctrl/⌘+click opens the file where a name is declared, at the line.",
  },
  {
    key: "Ctrl/⌘+P, then #",
    title: "Go to any symbol",
    body: "Type # and part of a name: every function, class, type and constant in the project that fits, with its file. Enter opens it at the line.",
  },
  {
    key: "F2",
    title: "Rename everywhere",
    body: "Every use, in every file, in one step. Comments and strings keep the old name. One Undo puts it back.",
  },
  {
    key: "Shift+F12",
    title: "Every reference",
    body: "Every place a name is declared or used, by file, in the sidebar. A row opens the file there.",
    shot: {
      src: "/editor/references.jpg",
      alt: "The References sidebar listing every use of listTasks, grouped by file",
    },
  },
  {
    key: "As you type",
    title: "Type errors, live",
    body: "Errors are underlined a moment after you stop typing, and the status bar counts them.",
  },
  {
    key: "Ctrl/⌘+.",
    title: "Quick fixes",
    body: "TypeScript's own fixes, such as adding a missing import, written with one Undo.",
  },
  {
    key: "Ctrl/⌘+Shift+M",
    title: "Problems in the whole project",
    body: "Every type error in every file, checked again as you edit. A row opens the file at the error.",
    shot: {
      src: "/editor/problems.jpg",
      alt: "The Problems sidebar listing a type error in store.ts, with the line underlined in the editor",
    },
  },
  {
    key: "Ctrl/⌘+Shift+R",
    title: "Refactor",
    body: "Extract the selection to a function or a constant, move code to a new file, convert an arrow function, and TypeScript's other refactors. One Undo puts it back.",
  },
  {
    key: "✎ in the file tree",
    title: "Move a file, keep its imports",
    body: "Rename a file or move it to another folder, and every import of it is rewritten, the file's own included. One Undo puts it back.",
  },
  {
    key: "Shift+Alt+O",
    title: "Organize imports",
    body: "Drops the imports nothing uses and sorts the rest.",
  },
];

/** The few the landing page names, in its order. */
export const LANDING_KEYS = ["F2", "Shift+F12", "Ctrl/⌘+.", "Ctrl/⌘+Shift+M", "( and ,"];
