import { a as scopedWorkerInput, r as mergeFanoutResults } from "./fanout-7r58zqMR.mjs";
import { runAgentLoopStreaming } from "./loop.server-_iEdKLEZ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fanout.server-Dhf9pPOp.js
function applyNotes(edits, noted) {
	return edits.map((edit) => {
		const extra = noted.filter((row) => row.path === edit.path).flatMap((row) => row.notes ?? []);
		return extra.length ? {
			...edit,
			notes: [...edit.notes ?? [], ...extra]
		} : edit;
	});
}
async function runComposerStreaming(input, cfg, emit, signal, afford, resolveWorker) {
	const assignments = (input.workers ?? []).filter((w) => w.files.length > 0).slice(0, 3);
	if (assignments.length === 0) return {
		result: await runAgentLoopStreaming(input, cfg, emit, signal),
		turns: 1,
		bills: [{
			hosted: cfg.hosted,
			cents: cfg.cents
		}]
	};
	const builders = assignments.filter((w) => (w.role ?? "build") === "build");
	const reviewers = assignments.filter((w) => w.role === "review");
	const n = assignments.length;
	if (!await afford(n)) {
		const error = `Need ${n} turns for these workers. Confirm a smaller crew or raise the session cap.`;
		emit({
			type: "error",
			error
		});
		return {
			result: {
				ok: false,
				error
			},
			turns: 0,
			bills: []
		};
	}
	const bills = assignments.map(() => ({
		hosted: cfg.hosted,
		cents: cfg.cents
	}));
	async function cfgOf(worker) {
		const index = Math.max(0, assignments.indexOf(worker));
		if (!resolveWorker) return cfg;
		const resolved = await resolveWorker(worker.source);
		bills[index] = {
			hosted: resolved.hosted,
			cents: resolved.cents
		};
		return resolved;
	}
	function forward(tag, i) {
		return (event) => {
			if (event.type === "status") emit({
				type: "status",
				text: `${tag} · ${event.text}`
			});
			if (event.type === "trace") emit({
				type: "trace",
				trace: {
					...event.trace,
					id: `w${i}_${event.trace.id}`,
					name: `${tag} · ${event.trace.name}`
				}
			});
		};
	}
	emit({
		type: "status",
		text: reviewers.length ? `${builders.length} builder${builders.length === 1 ? "" : "s"}${builders.length ? " then " : ""}${reviewers.length} review` : `Building ${builders.length} workers`
	});
	let merged;
	if (builders.length >= 2) {
		const results = await Promise.all(builders.map(async (worker, i) => {
			const tag = worker.label || worker.files[0] || `worker ${i + 1}`;
			try {
				const workerCfg = await cfgOf(worker);
				return runAgentLoopStreaming(scopedWorkerInput(input, worker), workerCfg, forward(tag, i), signal);
			} catch (error) {
				return {
					ok: false,
					error: error instanceof Error ? error.message : "Worker failed to start"
				};
			}
		}));
		merged = mergeFanoutResults(results, builders, input.approvedPlan ?? []);
	} else if (builders.length === 1) {
		const worker = builders[0];
		const tag = worker.label || "Build";
		try {
			const workerCfg = await cfgOf(worker);
			merged = await runAgentLoopStreaming(scopedWorkerInput(input, worker), workerCfg, forward(tag, 0), signal);
		} catch (error) {
			merged = {
				ok: false,
				error: error instanceof Error ? error.message : "Worker failed to start"
			};
		}
	} else merged = {
		ok: true,
		text: "",
		traces: [],
		edits: input.pendingEdits ?? []
	};
	if (signal?.aborted) return {
		result: {
			ok: false,
			error: "Stopped."
		},
		turns: n,
		bills: []
	};
	if (!merged.ok) {
		emit({
			type: "error",
			error: merged.error
		});
		return {
			result: merged,
			turns: n,
			bills
		};
	}
	let edits = merged.edits;
	let traces = merged.traces;
	let text = merged.text;
	if (reviewers.length) {
		const files = input.files.map((file) => {
			const edit = edits.find((row) => row.path === file.path);
			return edit ? {
				...file,
				content: edit.newText
			} : file;
		});
		for (let i = 0; i < reviewers.length; i += 1) {
			if (signal?.aborted) break;
			const worker = reviewers[i];
			const tag = worker.label || "Review";
			const index = builders.length + i;
			try {
				const workerCfg = await cfgOf(worker);
				const reviewed = await runAgentLoopStreaming(scopedWorkerInput({
					...input,
					files,
					pendingEdits: edits,
					workers: void 0
				}, worker), workerCfg, forward(tag, index), signal);
				if (reviewed.ok) {
					edits = applyNotes(edits, reviewed.edits);
					traces = [...traces, ...reviewed.traces];
					if (reviewed.text.trim()) text = [text, reviewed.text.trim()].filter(Boolean).join("\n\n");
				}
			} catch (error) {
				traces = [...traces, {
					id: `w${index}_err`,
					name: tag,
					args: {},
					resultPreview: error instanceof Error ? error.message : "Review failed",
					ms: 0
				}];
			}
		}
	}
	const result = {
		ok: true,
		text: text || "Done.",
		traces,
		edits,
		plan: "plan" in merged ? merged.plan : input.approvedPlan,
		awaitingBuild: false
	};
	emit({
		type: "done",
		text: result.text,
		traces: result.traces,
		edits: result.edits,
		plan: result.plan,
		awaitingBuild: false
	});
	if (result.edits.length) emit({
		type: "edits",
		edits: result.edits
	});
	return {
		result,
		turns: n,
		bills
	};
}
//#endregion
export { runComposerStreaming };
