//#region node_modules/.nitro/vite/services/ssr/assets/fanout-7r58zqMR.js
var PATH_LIKE = /(?:[\w.-]+\/)+[\w.-]+\.[\w]+|\b[\w.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|md|json|css|html|vue|go|rs)\b/g;
function resolvePath(token, known) {
	const t = token.replace(/^\.\//, "").replace(/\\/g, "/");
	const exact = known.filter((p) => p === t || p.endsWith(`/${t}`));
	if (exact.length === 1) return exact[0];
	return null;
}
function pathsInStep(content, known) {
	const found = /* @__PURE__ */ new Set();
	const matches = content.match(PATH_LIKE) ?? [];
	for (const raw of matches) {
		const path = resolvePath(raw, known);
		if (path) found.add(path);
	}
	return [...found];
}
function find(parent, x) {
	const p = parent.get(x) ?? x;
	if (p !== x) {
		const root = find(parent, p);
		parent.set(x, root);
		return root;
	}
	return p;
}
function union(parent, a, b) {
	const pa = find(parent, a);
	const pb = find(parent, b);
	if (pa !== pb) parent.set(pa, pb);
}
/** Independent file groups from a plan. Empty = do not fan out (overlap, unscoped, or one file). */
function fanoutWorkers(plan, knownFiles) {
	if (plan.length === 0 || knownFiles.length === 0) return [];
	const stepFiles = plan.map((step) => pathsInStep(step.content, knownFiles));
	if (stepFiles.some((files) => files.length === 0)) return [];
	const parent = /* @__PURE__ */ new Map();
	for (const files of stepFiles) {
		for (const file of files) parent.set(file, parent.get(file) ?? file);
		for (let i = 1; i < files.length; i += 1) union(parent, files[0], files[i]);
	}
	const groups = /* @__PURE__ */ new Map();
	for (const file of parent.keys()) {
		const root = find(parent, file);
		const set = groups.get(root) ?? /* @__PURE__ */ new Set();
		set.add(file);
		groups.set(root, set);
	}
	if (groups.size < 2) return [];
	let workers = [...groups.values()].map((files) => ({
		files: [...files].sort(),
		steps: plan.filter((_, i) => stepFiles[i].some((f) => files.has(f)))
	}));
	workers.sort((a, b) => b.files.length - a.files.length);
	while (workers.length > 3) {
		const small = workers.pop();
		const last = workers[workers.length - 1];
		workers[workers.length - 1] = {
			files: [.../* @__PURE__ */ new Set([...last.files, ...small.files])].sort(),
			steps: [...last.steps, ...small.steps]
		};
	}
	return workers;
}
/** How many billed turns Build it will actually consume. */
function billedWorkers(plan, knownFiles, canPay) {
	const groups = fanoutWorkers(plan ?? [], knownFiles);
	if (groups.length < 2) return 1;
	return canPay(groups.length) ? groups.length : 1;
}
function scopedBuildInput(base, worker) {
	const owned = worker.files.join(", ");
	const steps = worker.steps.map((entry, i) => `${i + 1}. ${entry.content}`).join("\n");
	return {
		...base,
		phase: "build",
		approvedPlan: worker.steps,
		instruction: `Build it.\n\nYou own only these files: ${owned}. Do not propose_edit any other path. Read other files if you need context.\n\nYour steps:\n${steps}`
	};
}
function scopedWorkerInput(base, worker) {
	if ((worker.role ?? "build") === "review") return {
		...base,
		phase: "skip",
		role: "review",
		approvedPlan: void 0,
		instruction: `Review the staged diffs. Call note_diff for each real issue (bug, regression, missing edge). Do not propose_edit. Do not rewrite files.\nFiles: ${worker.files.join(", ")}`
	};
	return scopedBuildInput(base, worker);
}
function mergeFanoutResults(results, workers, approved) {
	const traces = [];
	const edits = [];
	const texts = [];
	let anyOk = false;
	for (let i = 0; i < results.length; i += 1) {
		const result = results[i];
		const worker = workers[i];
		const allow = new Set(worker.files);
		const tag = worker.files[0] ?? `file ${i + 1}`;
		if (!result.ok) {
			traces.push({
				id: `w${i}_err`,
				name: tag,
				args: {},
				resultPreview: result.error,
				ms: 0
			});
			continue;
		}
		anyOk = true;
		if (result.text.trim()) texts.push(result.text.trim());
		traces.push(...result.traces.map((trace) => ({
			...trace,
			id: `w${i}_${trace.id}`,
			name: `${tag} · ${trace.name}`
		})));
		for (const edit of result.edits) {
			if (!allow.has(edit.path)) continue;
			edits.push({
				...edit,
				id: `w${i}_${edit.id}`
			});
		}
	}
	if (!anyOk) {
		const first = results.find((r) => !r.ok);
		return first && !first.ok ? first : {
			ok: false,
			error: "Build failed."
		};
	}
	const completed = /* @__PURE__ */ new Set();
	for (const result of results) {
		if (!result.ok) continue;
		for (const step of result.plan ?? []) if (step.status === "completed") completed.add(step.id);
	}
	const plan = approved.map((step) => completed.has(step.id) ? {
		...step,
		status: "completed"
	} : step);
	return {
		ok: true,
		text: texts.join("\n\n") || "Done.",
		traces,
		edits,
		plan,
		awaitingBuild: false
	};
}
//#endregion
export { scopedWorkerInput as a, pathsInStep as i, fanoutWorkers as n, mergeFanoutResults as r, billedWorkers as t };
