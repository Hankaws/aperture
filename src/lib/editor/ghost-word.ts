export function takeGhostWord(ghost: string): { take: string; rest: string } {
  if (!ghost) return { take: "", rest: "" };
  const match = /^(\n[^\n]*|\s*\.[A-Za-z_$][\w$]*|\s*[A-Za-z_$][\w$]*|\s*[^\s\w]+|\s+)/.exec(ghost);
  const take = match?.[1] ?? ghost[0]!;
  return { take, rest: ghost.slice(take.length) };
}
