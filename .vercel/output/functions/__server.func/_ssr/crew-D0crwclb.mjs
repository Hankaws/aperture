import { n as BUILTIN_ACP } from "./kinds-CCf1JBpH.mjs";
import { n as PROVIDERS } from "./plans-CTIRB29R.mjs";
import { i as pathsInStep, n as fanoutWorkers } from "./fanout-7r58zqMR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/crew-D0crwclb.js
function availableSeats(account) {
	const seats = [{
		id: "hosted",
		kind: "model",
		label: "Grok",
		source: "hosted",
		ready: true,
		hint: "Hosted"
	}];
	for (const provider of PROVIDERS) {
		if (provider.id === "grok") continue;
		const ready = Boolean(account?.keys[provider.id]?.set);
		seats.push({
			id: provider.id,
			kind: "model",
			label: provider.short,
			source: provider.id,
			ready,
			hint: ready ? "Your key" : "Add key in Settings"
		});
	}
	if (Boolean(account?.keys.grok?.set)) seats.push({
		id: "grok",
		kind: "model",
		label: "Grok key",
		source: "grok",
		ready: true,
		hint: "Your key"
	});
	for (const agent of BUILTIN_ACP) seats.push({
		id: agent.id,
		kind: "acp",
		label: agent.name,
		agentId: agent.id,
		ready: Boolean(account?.acp),
		hint: account?.acp ? "ACP · same diffs" : "ACP is on Pro"
	});
	return seats;
}
function selectedSeats(seats, ids) {
	const set = new Set(ids.length ? ids : ["hosted"]);
	const picked = seats.filter((s) => set.has(s.id) && s.ready);
	return picked.length ? picked : seats.filter((s) => s.id === "hosted");
}
function modelSeats(seats) {
	return seats.filter((s) => s.kind === "model" && s.ready);
}
function parseWorkerRole(value) {
	return value === "review" ? "review" : "build";
}
function workerLabel(seat, files, role = "build") {
	const names = files.map((f) => f.split("/").pop()).join(", ");
	return `${seat.label} · ${role === "review" ? "Review" : "Build"} · ${names}`;
}
function seatKey(seat) {
	return seat.source ?? seat.agentId ?? seat.id;
}
function workerKey(worker) {
	return worker.source ?? worker.agentId ?? "";
}
function specFrom(seat, group, plan, role) {
	const steps = group.steps.length ? group.steps : plan;
	return {
		files: group.files,
		steps,
		source: seat.source,
		agentId: null,
		role,
		label: workerLabel(seat, group.files, role)
	};
}
function filesFromPlan(plan, knownFiles) {
	const found = /* @__PURE__ */ new Set();
	for (const step of plan) for (const path of pathsInStep(step.content, knownFiles)) found.add(path);
	return found.size ? [...found] : knownFiles.slice(0, 4);
}
function proposeWorkers(plan, knownFiles, seats) {
	const pool = modelSeats(seats);
	if (pool.length === 0 || plan.length === 0) return [];
	const groups = fanoutWorkers(plan, knownFiles);
	const builders = groups.length >= 2 ? groups.slice(0, 3).map((group, i) => specFrom(pool[i % pool.length], group, plan, "build")) : pool.length >= 2 ? [specFrom(pool[0], {
		files: filesFromPlan(plan, knownFiles),
		steps: plan
	}, plan, "build")] : [];
	if (builders.length === 0) return [];
	if (pool.length >= 2 && builders.length < 3) {
		const reviewSeat = pool.find((s) => s.source !== builders[0]?.source) ?? pool[1];
		const files = [...new Set(builders.flatMap((w) => w.files))];
		builders.push(specFrom(reviewSeat, {
			files,
			steps: []
		}, plan, "review"));
	}
	return builders.slice(0, 3);
}
function proposeReviewer(paths, seats, exclude) {
	if (paths.length === 0) return [];
	const pool = modelSeats(seats);
	const seat = pool.find((s) => s.source && s.source !== exclude) ?? pool[0];
	if (!seat) return [];
	return [specFrom(seat, {
		files: paths,
		steps: []
	}, [], "review")];
}
function addWorker(existing, seats, knownFiles, plan) {
	if (existing.length >= 3) return existing;
	const pool = modelSeats(seats);
	if (pool.length === 0) return existing;
	const owned = new Set(existing.filter((w) => (w.role ?? "build") === "build").flatMap((w) => w.files));
	let files = knownFiles.filter((f) => !owned.has(f)).slice(0, 3);
	let next = existing;
	if (files.length === 0) {
		const big = [...existing].filter((w) => (w.role ?? "build") === "build").sort((a, b) => b.files.length - a.files.length)[0];
		if (!big || big.files.length < 2) return existing;
		const split = Math.ceil(big.files.length / 2);
		files = big.files.slice(split);
		const keep = big.files.slice(0, split);
		const keepSeat = pool.find((s) => (s.source ?? "") === (big.source ?? "")) ?? pool[0];
		next = existing.map((w) => w === big ? {
			...w,
			files: keep,
			label: workerLabel(keepSeat, keep, "build")
		} : w);
	}
	const used = new Set(next.map(workerKey));
	const seat = pool.find((s) => !used.has(seatKey(s))) ?? pool[next.length % pool.length];
	return [...next, specFrom(seat, {
		files,
		steps: plan
	}, plan, "build")];
}
function dropWorker(existing, index) {
	return existing.filter((_, i) => i !== index);
}
function toggleWorkerRole(existing, index, seats) {
	return existing.map((worker, i) => {
		if (i !== index) return worker;
		const role = worker.role === "review" ? "build" : "review";
		const seat = seats.find((s) => s.source === worker.source) ?? {
			id: worker.source ?? "hosted",
			kind: "model",
			label: worker.label.split(" · ")[0] ?? "Grok",
			ready: true,
			hint: "",
			source: worker.source
		};
		return {
			...worker,
			role,
			label: workerLabel(seat, worker.files, role)
		};
	});
}
function canConfirm(workers) {
	if (workers.length === 0 || workers.some((w) => w.files.length === 0 || w.agentId)) return false;
	const builds = workers.filter((w) => (w.role ?? "build") === "build");
	const reviews = workers.filter((w) => w.role === "review");
	return builds.length >= 2 || reviews.length >= 1;
}
//#endregion
export { modelSeats as a, proposeWorkers as c, dropWorker as i, selectedSeats as l, availableSeats as n, parseWorkerRole as o, canConfirm as r, proposeReviewer as s, addWorker as t, toggleWorkerRole as u };
