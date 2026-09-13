import { i as scopedBuildInput, n as fanoutWorkers, r as mergeFanoutResults } from "./fanout-DWEWLENg.mjs";
import { runAgentLoopStreaming } from "./loop.server-I7u3pKN4.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fanout.server-DXXjVW92.js
async function runComposerStreaming(input, cfg, emit, signal, afford) {
	const plan = input.approvedPlan ?? [];
	const groups = input.phase === "build" && input.mode === "composer" ? fanoutWorkers(plan, input.files.map((f) => f.path)) : [];
	const n = groups.length;
	if (!(n >= 2 && await afford(n))) return {
		result: await runAgentLoopStreaming(input, cfg, emit, signal),
		turns: 1
	};
	emit({
		type: "status",
		text: `Building ${n} files in parallel · ${n} turns`
	});
	const results = await Promise.all(groups.map((worker, i) => runAgentLoopStreaming(scopedBuildInput(input, worker), cfg, (event) => {
		const tag = worker.files[0] ?? `file ${i + 1}`;
		if (event.type === "status") {
			emit({
				type: "status",
				text: `${tag} · ${event.text}`
			});
			return;
		}
		if (event.type === "trace") emit({
			type: "trace",
			trace: {
				...event.trace,
				id: `w${i}_${event.trace.id}`,
				name: `${tag} · ${event.trace.name}`
			}
		});
	}, signal)));
	if (signal?.aborted) return {
		result: {
			ok: false,
			error: "Stopped."
		},
		turns: n
	};
	const result = mergeFanoutResults(results, groups, plan);
	if (result.ok) {
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
		if (result.plan?.length) emit({
			type: "plan",
			entries: result.plan
		});
	} else emit({
		type: "error",
		error: result.error
	});
	return {
		result,
		turns: n
	};
}
//#endregion
export { runComposerStreaming };
