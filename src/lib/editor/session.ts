export type EditorSession = {
  anchor: number;
  head: number;
  scrollTop: number;
};

const sessions = new Map<string, EditorSession>();

export function saveSession(path: string, session: EditorSession) {
  sessions.set(path, session);
}

export function loadSession(path: string): EditorSession | undefined {
  return sessions.get(path);
}

export function clampSession(session: EditorSession, length: number): EditorSession {
  return {
    anchor: Math.max(0, Math.min(session.anchor, length)),
    head: Math.max(0, Math.min(session.head, length)),
    scrollTop: Math.max(0, session.scrollTop),
  };
}
