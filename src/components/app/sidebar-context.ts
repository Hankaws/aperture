import { createContext, useContext } from "react";

/** Lets a page open the sidebar on a phone from its own header, as the chat page does. */
export const DrawerContext = createContext<(() => void) | null>(null);

/** Opens the sidebar on a phone; null outside the app's frame (`app-shell.tsx`). */
export function useOpenSidebar(): (() => void) | null {
  return useContext(DrawerContext);
}
