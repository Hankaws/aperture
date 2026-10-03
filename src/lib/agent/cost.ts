/** Anthropic caches a prefix when the block is marked. The same bytes are billed once. */
export function cachedText(text: string): Array<{ type: "text"; text: string; cache_control: { type: "ephemeral" } }> {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

/** Stop the turn once an edit is staged, unless that edit's own check is red. */
export function stagedEditSettled(results: string[]): boolean {
  const staged = results.filter((text) => text.startsWith("Edit staged"));
  return staged.length > 0 && staged.every((text) => !text.includes(" failed:"));
}
