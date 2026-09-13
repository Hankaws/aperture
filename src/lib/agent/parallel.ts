export function isReadTool(name: string): boolean {
  return name === "semantic_search" || name === "grep" || name === "read_file" || name === "list_dir";
}

export type ParsedCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export function parseCall(call: { id: string; function: { name: string; arguments: string } }): ParsedCall {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
  } catch {
    args = {};
  }
  return { id: call.id, name: call.function.name, args };
}

/** Consecutive read-only tools share a batch; mutating tools stay ordered. */
export function partitionCalls(calls: ParsedCall[]): ParsedCall[][] {
  const batches: ParsedCall[][] = [];
  for (const call of calls) {
    const last = batches[batches.length - 1];
    if (last && last.every((c) => isReadTool(c.name)) && isReadTool(call.name)) {
      last.push(call);
      continue;
    }
    batches.push([call]);
  }
  return batches;
}
