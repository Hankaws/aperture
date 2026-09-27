import { useHydrated } from "@tanstack/react-router";
import { authEnabled } from "./auth/client";
import { useCurrentUserState, type CurrentUserState } from "./auth/use-current-user";

const PENDING: CurrentUserState = { user: null, isPending: true };

/**
 * `useCurrentUserState()` for markup that is server-rendered. The server always
 * sees a pending session, but the client's session store can settle before
 * hydration, so branching on the raw state renders different HTML on each side
 * (a React hydration mismatch). Until hydration finishes this reports pending,
 * matching the server; the real state follows on the next render. With auth off
 * both sides agree on the dev user, so it passes through untouched.
 */
export function useHydratedUserState(): CurrentUserState {
  const state = useCurrentUserState();
  const hydrated = useHydrated();
  return !authEnabled || hydrated ? state : PENDING;
}
