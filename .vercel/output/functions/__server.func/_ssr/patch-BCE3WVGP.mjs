//#region node_modules/.nitro/vite/services/ssr/assets/patch-BCE3WVGP.js
function splitLines(text) {
	return text.replace(/\r\n/g, "\n").split("\n");
}
function applyHunk(lines, oldStart, remove, add) {
	const idx = Math.max(0, oldStart - 1);
	const slice = lines.slice(idx, idx + remove.length);
	if (remove.length === 0 || slice.length === remove.length && slice.every((line, i) => line === remove[i])) return [
		...lines.slice(0, idx),
		...add,
		...lines.slice(idx + remove.length)
	];
	if (remove.length === 0) return null;
	const joined = remove.join("\n");
	const hay = lines.join("\n");
	const at = hay.indexOf(joined);
	if (at < 0) return null;
	const before = hay.slice(0, at);
	const after = hay.slice(at + joined.length);
	return splitLines(`${before}${add.join("\n")}${after}`);
}
/** Turn a unified diff into staged full-file edits against the current workspace. */
function parseUnifiedDiff(diff, files) {
	const text = diff.replace(/\r\n/g, "\n").trim();
	if (!text) return { error: "Paste a unified diff first." };
	const edits = [];
	const blocks = text.split(/^diff --git /m);
	const chunks = blocks.length > 1 ? blocks.slice(1) : [text];
	for (const chunk of chunks) {
		const body = chunk.startsWith("a/") || chunk.startsWith("b/") || chunk.includes("\n--- ") ? chunk.startsWith("a/") ? `diff --git ${chunk}` : chunk : chunk;
		const plus = body.match(/^\+\+\+\s+(?:b\/)?(.+)$/m);
		const minus = body.match(/^---\s+(?:a\/)?(.+)$/m);
		let path = (plus?.[1] ?? minus?.[1] ?? "").trim();
		if (!path || path === "/dev/null") {
			const git = body.match(/diff --git a\/(.+?) b\/(.+)/);
			path = (git?.[2] ?? git?.[1] ?? "").trim();
		}
		if (!path || path === "/dev/null") continue;
		path = path.replace(/^b\//, "").replace(/^a\//, "");
		if (path.includes("..")) continue;
		let current = files[path] !== void 0 ? splitLines(files[path]) : [];
		const wasEmpty = files[path] === void 0;
		const hunks = body.split(/^@@ /m).slice(1);
		if (hunks.length === 0) continue;
		for (const hunk of hunks) {
			const header = hunk.match(/^-(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
			const oldStart = header ? Number(header[1]) : 1;
			const lines = hunk.split("\n").slice(1);
			const remove = [];
			const add = [];
			for (const line of lines) {
				if (line.startsWith("\\") || line.startsWith("diff ") || line.startsWith("index ")) break;
				if (line.startsWith("--- ") || line.startsWith("+++ ")) break;
				if (line.startsWith("-")) remove.push(line.slice(1));
				else if (line.startsWith("+")) add.push(line.slice(1));
				else if (line.startsWith(" ")) {
					remove.push(line.slice(1));
					add.push(line.slice(1));
				} else if (line === "") {
					remove.push("");
					add.push("");
				}
			}
			const next = applyHunk(current, oldStart, remove, add);
			if (!next) return { error: `Could not apply a hunk in ${path}. The file may have changed.` };
			current = next;
		}
		const oldText = wasEmpty ? "" : files[path] ?? "";
		const newText = current.join("\n");
		if (oldText === newText) continue;
		edits.push({
			id: `patch_${edits.length + 1}_${path}`,
			path,
			oldText,
			newText,
			description: wasEmpty ? `Create ${path}` : `Patch ${path}`,
			status: "pending"
		});
	}
	if (edits.length === 0) return { error: "No file edits found in that diff." };
	return edits;
}
//#endregion
export { parseUnifiedDiff as t };
