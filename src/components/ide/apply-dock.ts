import { createContext } from "react";

/**
 * Where the phone's verdict-and-Apply bar goes: under the code, set by the
 * editor column (editor-column.tsx) and filled by the review strip.
 */
export const ApplyDockContext = createContext<HTMLElement | null>(null);
