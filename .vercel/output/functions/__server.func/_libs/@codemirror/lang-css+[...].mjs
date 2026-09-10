import { B as tags$1, G as NodeType, H as IterMode, J as Tree, K as NodeWeakMap, L as syntaxTree, T as foldNodeProp, U as NodeProp, V as DefaultBufferLength, W as NodeSet, d as LRLanguage, k as indentNodeProp, m as LanguageSupport, q as Parser, v as continuedIndent, w as foldInside, z as styleTags } from "./autocomplete+[...].mjs";
//#region node_modules/@lezer/lr/dist/index.js
/**
A parse stack. These are used internally by the parser to track
parsing progress. They also provide some properties and methods
that external code such as a tokenizer can use to get information
about the parse state.
*/
var Stack = class Stack {
	/**
	@internal
	*/
	constructor(p, stack, state, reducePos, pos, score, buffer, bufferBase, curContext, lookAhead = 0, parent) {
		this.p = p;
		this.stack = stack;
		this.state = state;
		this.reducePos = reducePos;
		this.pos = pos;
		this.score = score;
		this.buffer = buffer;
		this.bufferBase = bufferBase;
		this.curContext = curContext;
		this.lookAhead = lookAhead;
		this.parent = parent;
	}
	/**
	@internal
	*/
	toString() {
		return `[${this.stack.filter((_, i) => i % 3 == 0).concat(this.state)}]@${this.pos}${this.score ? "!" + this.score : ""}`;
	}
	/**
	@internal
	*/
	static start(p, state, pos = 0) {
		let cx = p.parser.context;
		return new Stack(p, [], state, pos, pos, 0, [], 0, cx ? new StackContext(cx, cx.start) : null, 0, null);
	}
	/**
	The stack's current [context](#lr.ContextTracker) value, if
	any. Its type will depend on the context tracker's type
	parameter, or it will be `null` if there is no context
	tracker.
	*/
	get context() {
		return this.curContext ? this.curContext.context : null;
	}
	/**
	@internal
	*/
	pushState(state, start) {
		this.stack.push(this.state, start, this.bufferBase + this.buffer.length);
		this.state = state;
	}
	/**
	@internal
	*/
	reduce(action) {
		var _a;
		let depth = action >> 19, type = action & 65535;
		let { parser } = this.p;
		let lookaheadRecord = this.reducePos < this.pos - 25 && this.setLookAhead(this.pos);
		let dPrec = parser.dynamicPrecedence(type);
		if (dPrec) this.score += dPrec;
		if (depth == 0) {
			if (type < parser.minRepeatTerm && this.reducePos < this.pos) this.reducePos = this.pos;
			this.pushState(parser.getGoto(this.state, type, true), this.reducePos);
			if (type < parser.minRepeatTerm) this.storeNode(type, this.reducePos, this.reducePos, lookaheadRecord ? 8 : 4, true);
			this.reduceContext(type, this.reducePos);
			return;
		}
		let base = this.stack.length - (depth - 1) * 3 - (action & 262144 ? 6 : 0);
		let start = base ? this.stack[base - 2] : this.p.ranges[0].from;
		if (type < parser.minRepeatTerm && start == this.reducePos && this.reducePos < this.pos) this.reducePos = this.pos;
		let size = this.reducePos - start;
		if (size >= 2e3 && !((_a = this.p.parser.nodeSet.types[type]) === null || _a === void 0 ? void 0 : _a.isAnonymous)) {
			if (start == this.p.lastBigReductionStart) {
				this.p.bigReductionCount++;
				this.p.lastBigReductionSize = size;
			} else if (this.p.lastBigReductionSize < size) {
				this.p.bigReductionCount = 1;
				this.p.lastBigReductionStart = start;
				this.p.lastBigReductionSize = size;
			}
		}
		let bufferBase = base ? this.stack[base - 1] : 0, count = this.bufferBase + this.buffer.length - bufferBase;
		if (type < parser.minRepeatTerm || action & 131072) {
			let pos = parser.stateFlag(this.state, 1) ? this.pos : this.reducePos;
			this.storeNode(type, start, pos, count + 4, true);
		}
		if (action & 262144) this.state = this.stack[base];
		else {
			let baseStateID = this.stack[base - 3];
			this.state = parser.getGoto(baseStateID, type, true);
		}
		while (this.stack.length > base) this.stack.pop();
		this.reduceContext(type, start);
	}
	/**
	@internal
	*/
	storeNode(term, start, end, size = 4, mustSink = false) {
		if (term == 0 && (!this.stack.length || this.stack[this.stack.length - 1] < this.buffer.length + this.bufferBase)) {
			let top = this.buffer.length;
			if (top > 0 && this.buffer[top - 4] == 0 && this.buffer[top - 1] > -1) {
				if (start == end) return;
				if (this.buffer[top - 2] >= start) {
					this.buffer[top - 2] = end;
					return;
				}
			}
		}
		if (!mustSink || this.pos == end) this.buffer.push(term, start, end, size);
		else {
			let index = this.buffer.length;
			if (index > 0 && (this.buffer[index - 4] != 0 || this.buffer[index - 1] < 0)) {
				let mustMove = false;
				for (let scan = index; scan > 0 && this.buffer[scan - 2] > end; scan -= 4) if (this.buffer[scan - 1] >= 0) {
					mustMove = true;
					break;
				}
				if (mustMove) while (index > 0 && this.buffer[index - 2] > end) {
					this.buffer[index] = this.buffer[index - 4];
					this.buffer[index + 1] = this.buffer[index - 3];
					this.buffer[index + 2] = this.buffer[index - 2];
					this.buffer[index + 3] = this.buffer[index - 1];
					index -= 4;
					if (size > 4) size -= 4;
				}
			}
			this.buffer[index] = term;
			this.buffer[index + 1] = start;
			this.buffer[index + 2] = end;
			this.buffer[index + 3] = size;
		}
	}
	/**
	@internal
	*/
	shift(action, type, start, end) {
		if (action & 131072) this.pushState(action & 65535, this.pos);
		else if ((action & 262144) == 0) {
			let nextState = action, { parser } = this.p;
			this.pos = end;
			let skipped = parser.stateFlag(nextState, 1);
			if (!skipped && (end > start || type <= parser.maxNode)) this.reducePos = end;
			this.pushState(nextState, skipped ? start : Math.min(start, this.reducePos));
			this.shiftContext(type, start);
			if (type <= parser.maxNode) this.buffer.push(type, start, end, 4);
		} else {
			this.pos = end;
			this.shiftContext(type, start);
			if (type <= this.p.parser.maxNode) this.buffer.push(type, start, end, 4);
		}
	}
	/**
	@internal
	*/
	apply(action, next, nextStart, nextEnd) {
		if (action & 65536) this.reduce(action);
		else this.shift(action, next, nextStart, nextEnd);
	}
	/**
	@internal
	*/
	useNode(value, next) {
		let index = this.p.reused.length - 1;
		if (index < 0 || this.p.reused[index] != value) {
			this.p.reused.push(value);
			index++;
		}
		let start = this.pos;
		this.reducePos = this.pos = start + value.length;
		this.pushState(next, start);
		this.buffer.push(index, start, this.reducePos, -1);
		if (this.curContext) this.updateContext(this.curContext.tracker.reuse(this.curContext.context, value, this, this.p.stream.reset(this.pos - value.length)));
	}
	/**
	@internal
	*/
	split() {
		let parent = this;
		let off = parent.buffer.length;
		if (off && parent.buffer[off - 4] == 0) off -= 4;
		while (off > 0 && parent.buffer[off - 2] > parent.reducePos) off -= 4;
		let buffer = parent.buffer.slice(off), base = parent.bufferBase + off;
		while (parent && base == parent.bufferBase) parent = parent.parent;
		return new Stack(this.p, this.stack.slice(), this.state, this.reducePos, this.pos, this.score, buffer, base, this.curContext, this.lookAhead, parent);
	}
	/**
	@internal
	*/
	recoverByDelete(next, nextEnd) {
		let isNode = next <= this.p.parser.maxNode;
		if (isNode) this.storeNode(next, this.pos, nextEnd, 4);
		this.storeNode(0, this.pos, nextEnd, isNode ? 8 : 4);
		this.pos = this.reducePos = nextEnd;
		this.score -= 190;
	}
	/**
	Check if the given term would be able to be shifted (optionally
	after some reductions) on this stack. This can be useful for
	external tokenizers that want to make sure they only provide a
	given token when it applies.
	*/
	canShift(term) {
		for (let sim = new SimulatedStack(this);;) {
			let action = this.p.parser.stateSlot(sim.state, 4) || this.p.parser.hasAction(sim.state, term);
			if (action == 0) return false;
			if ((action & 65536) == 0) return true;
			sim.reduce(action);
		}
	}
	/**
	@internal
	*/
	recoverByInsert(next) {
		if (this.stack.length >= 300) return [];
		let nextStates = this.p.parser.nextStates(this.state);
		if (nextStates.length > 8 || this.stack.length >= 120) {
			let best = [];
			for (let i = 0, s; i < nextStates.length; i += 2) if ((s = nextStates[i + 1]) != this.state && this.p.parser.hasAction(s, next)) best.push(nextStates[i], s);
			if (this.stack.length < 120) for (let i = 0; best.length < 8 && i < nextStates.length; i += 2) {
				let s = nextStates[i + 1];
				if (!best.some((v, i) => i & 1 && v == s)) best.push(nextStates[i], s);
			}
			nextStates = best;
		}
		let result = [];
		for (let i = 0; i < nextStates.length && result.length < 4; i += 2) {
			let s = nextStates[i + 1];
			if (s == this.state) continue;
			let stack = this.split();
			stack.pushState(s, this.pos);
			stack.storeNode(0, stack.pos, stack.pos, 4, true);
			stack.shiftContext(nextStates[i], this.pos);
			stack.reducePos = this.pos;
			stack.score -= 200;
			result.push(stack);
		}
		return result;
	}
	/**
	@internal
	*/
	forceReduce() {
		let { parser } = this.p;
		let reduce = parser.stateSlot(this.state, 5);
		if ((reduce & 65536) == 0) return false;
		if (!parser.validAction(this.state, reduce)) {
			let depth = reduce >> 19, term = reduce & 65535;
			let target = this.stack.length - depth * 3;
			if (target < 0 || parser.getGoto(this.stack[target], term, false) < 0) {
				let backup = this.findForcedReduction();
				if (backup == null) return false;
				reduce = backup;
			}
			this.storeNode(0, this.pos, this.pos, 4, true);
			this.score -= 100;
		}
		this.reducePos = this.pos;
		this.reduce(reduce);
		return true;
	}
	/**
	Try to scan through the automaton to find some kind of reduction
	that can be applied. Used when the regular ForcedReduce field
	isn't a valid action. @internal
	*/
	findForcedReduction() {
		let { parser } = this.p, seen = [];
		let explore = (state, depth) => {
			if (seen.includes(state)) return;
			seen.push(state);
			return parser.allActions(state, (action) => {
				if (action & 393216);
				else if (action & 65536) {
					let rDepth = (action >> 19) - depth;
					if (rDepth > 1) {
						let term = action & 65535, target = this.stack.length - rDepth * 3;
						if (target >= 0 && parser.getGoto(this.stack[target], term, false) >= 0) return rDepth << 19 | 65536 | term;
					}
				} else {
					let found = explore(action, depth + 1);
					if (found != null) return found;
				}
			});
		};
		return explore(this.state, 0);
	}
	/**
	@internal
	*/
	forceAll() {
		while (!this.p.parser.stateFlag(this.state, 2)) if (!this.forceReduce()) {
			this.storeNode(0, this.pos, this.pos, 4, true);
			break;
		}
		return this;
	}
	/**
	Check whether this state has no further actions (assumed to be a direct descendant of the
	top state, since any other states must be able to continue
	somehow). @internal
	*/
	get deadEnd() {
		if (this.stack.length != 3) return false;
		let { parser } = this.p;
		return parser.data[parser.stateSlot(this.state, 1)] == 65535 && !parser.stateSlot(this.state, 4);
	}
	/**
	Restart the stack (put it back in its start state). Only safe
	when this.stack.length == 3 (state is directly below the top
	state). @internal
	*/
	restart() {
		this.storeNode(0, this.pos, this.pos, 4, true);
		this.state = this.stack[0];
		this.stack.length = 0;
	}
	/**
	@internal
	*/
	sameState(other) {
		if (this.state != other.state || this.stack.length != other.stack.length) return false;
		for (let i = 0; i < this.stack.length; i += 3) if (this.stack[i] != other.stack[i]) return false;
		return true;
	}
	/**
	Get the parser used by this stack.
	*/
	get parser() {
		return this.p.parser;
	}
	/**
	Test whether a given dialect (by numeric ID, as exported from
	the terms file) is enabled.
	*/
	dialectEnabled(dialectID) {
		return this.p.parser.dialect.flags[dialectID];
	}
	shiftContext(term, start) {
		if (this.curContext) this.updateContext(this.curContext.tracker.shift(this.curContext.context, term, this, this.p.stream.reset(start)));
	}
	reduceContext(term, start) {
		if (this.curContext) this.updateContext(this.curContext.tracker.reduce(this.curContext.context, term, this, this.p.stream.reset(start)));
	}
	/**
	@internal
	*/
	emitContext() {
		let last = this.buffer.length - 1;
		if (last < 0 || this.buffer[last] != -3) this.buffer.push(this.curContext.hash, this.pos, this.pos, -3);
	}
	/**
	@internal
	*/
	emitLookAhead() {
		let last = this.buffer.length - 1;
		if (last < 0 || this.buffer[last] != -4) this.buffer.push(this.lookAhead, this.pos, this.pos, -4);
	}
	updateContext(context) {
		if (context != this.curContext.context) {
			let newCx = new StackContext(this.curContext.tracker, context);
			if (newCx.hash != this.curContext.hash) this.emitContext();
			this.curContext = newCx;
		}
	}
	/**
	@internal
	*/
	setLookAhead(lookAhead) {
		if (lookAhead <= this.lookAhead) return false;
		this.emitLookAhead();
		this.lookAhead = lookAhead;
		return true;
	}
	/**
	@internal
	*/
	close() {
		if (this.curContext && this.curContext.tracker.strict) this.emitContext();
		if (this.lookAhead > 0) this.emitLookAhead();
	}
};
var StackContext = class {
	constructor(tracker, context) {
		this.tracker = tracker;
		this.context = context;
		this.hash = tracker.strict ? tracker.hash(context) : 0;
	}
};
var SimulatedStack = class {
	constructor(start) {
		this.start = start;
		this.state = start.state;
		this.stack = start.stack;
		this.base = this.stack.length;
	}
	reduce(action) {
		let term = action & 65535, depth = action >> 19;
		if (depth == 0) {
			if (this.stack == this.start.stack) this.stack = this.stack.slice();
			this.stack.push(this.state, 0, 0);
			this.base += 3;
		} else this.base -= (depth - 1) * 3;
		let goto = this.start.p.parser.getGoto(this.stack[this.base - 3], term, true);
		this.state = goto;
	}
};
var StackBufferCursor = class StackBufferCursor {
	constructor(stack, pos, index) {
		this.stack = stack;
		this.pos = pos;
		this.index = index;
		this.buffer = stack.buffer;
		if (this.index == 0) this.maybeNext();
	}
	static create(stack, pos = stack.bufferBase + stack.buffer.length) {
		return new StackBufferCursor(stack, pos, pos - stack.bufferBase);
	}
	maybeNext() {
		let next = this.stack.parent;
		if (next != null) {
			this.index = this.stack.bufferBase - next.bufferBase;
			this.stack = next;
			this.buffer = next.buffer;
		}
	}
	get id() {
		return this.buffer[this.index - 4];
	}
	get start() {
		return this.buffer[this.index - 3];
	}
	get end() {
		return this.buffer[this.index - 2];
	}
	get size() {
		return this.buffer[this.index - 1];
	}
	next() {
		this.index -= 4;
		this.pos -= 4;
		if (this.index == 0) this.maybeNext();
	}
	fork() {
		return new StackBufferCursor(this.stack, this.pos, this.index);
	}
};
function decodeArray(input, Type = Uint16Array) {
	if (typeof input != "string") return input;
	let array = null;
	for (let pos = 0, out = 0; pos < input.length;) {
		let value = 0;
		for (;;) {
			let next = input.charCodeAt(pos++), stop = false;
			if (next == 126) {
				value = 65535;
				break;
			}
			if (next >= 92) next--;
			if (next >= 34) next--;
			let digit = next - 32;
			if (digit >= 46) {
				digit -= 46;
				stop = true;
			}
			value += digit;
			if (stop) break;
			value *= 46;
		}
		if (array) array[out++] = value;
		else array = new Type(value);
	}
	return array;
}
var CachedToken = class {
	constructor() {
		this.start = -1;
		this.value = -1;
		this.end = -1;
		this.extended = -1;
		this.lookAhead = 0;
		this.mask = 0;
		this.context = 0;
	}
};
var nullToken = new CachedToken();
/**
[Tokenizers](#lr.ExternalTokenizer) interact with the input
through this interface. It presents the input as a stream of
characters, tracking lookahead and hiding the complexity of
[ranges](#common.Parser.parse^ranges) from tokenizer code.
*/
var InputStream = class {
	/**
	@internal
	*/
	constructor(input, ranges) {
		this.input = input;
		this.ranges = ranges;
		/**
		@internal
		*/
		this.chunk = "";
		/**
		@internal
		*/
		this.chunkOff = 0;
		/**
		Backup chunk
		*/
		this.chunk2 = "";
		this.chunk2Pos = 0;
		/**
		The character code of the next code unit in the input, or -1
		when the stream is at the end of the input.
		*/
		this.next = -1;
		/**
		@internal
		*/
		this.token = nullToken;
		this.rangeIndex = 0;
		this.pos = this.chunkPos = ranges[0].from;
		this.range = ranges[0];
		this.end = ranges[ranges.length - 1].to;
		this.readNext();
	}
	/**
	@internal
	*/
	resolveOffset(offset, assoc) {
		let range = this.range, index = this.rangeIndex;
		let pos = this.pos + offset;
		while (pos < range.from) {
			if (!index) return null;
			let next = this.ranges[--index];
			pos -= range.from - next.to;
			range = next;
		}
		while (assoc < 0 ? pos > range.to : pos >= range.to) {
			if (index == this.ranges.length - 1) return null;
			let next = this.ranges[++index];
			pos += next.from - range.to;
			range = next;
		}
		return pos;
	}
	/**
	@internal
	*/
	clipPos(pos) {
		if (pos >= this.range.from && pos < this.range.to) return pos;
		for (let range of this.ranges) if (range.to > pos) return Math.max(pos, range.from);
		return this.end;
	}
	/**
	Look at a code unit near the stream position. `.peek(0)` equals
	`.next`, `.peek(-1)` gives you the previous character, and so
	on.
	
	Note that looking around during tokenizing creates dependencies
	on potentially far-away content, which may reduce the
	effectiveness incremental parsing—when looking forward—or even
	cause invalid reparses when looking backward more than 25 code
	units, since the library does not track lookbehind.
	*/
	peek(offset) {
		let idx = this.chunkOff + offset, pos, result;
		if (idx >= 0 && idx < this.chunk.length) {
			pos = this.pos + offset;
			result = this.chunk.charCodeAt(idx);
		} else {
			let resolved = this.resolveOffset(offset, 1);
			if (resolved == null) return -1;
			pos = resolved;
			if (pos >= this.chunk2Pos && pos < this.chunk2Pos + this.chunk2.length) result = this.chunk2.charCodeAt(pos - this.chunk2Pos);
			else {
				let i = this.rangeIndex, range = this.range;
				while (range.to <= pos) range = this.ranges[++i];
				this.chunk2 = this.input.chunk(this.chunk2Pos = pos);
				if (pos + this.chunk2.length > range.to) this.chunk2 = this.chunk2.slice(0, range.to - pos);
				result = this.chunk2.charCodeAt(0);
			}
		}
		if (pos >= this.token.lookAhead) this.token.lookAhead = pos + 1;
		return result;
	}
	/**
	Accept a token. By default, the end of the token is set to the
	current stream position, but you can pass an offset (relative to
	the stream position) to change that.
	*/
	acceptToken(token, endOffset = 0) {
		let end = endOffset ? this.resolveOffset(endOffset, -1) : this.pos;
		if (end == null || end < this.token.start) throw new RangeError("Token end out of bounds");
		this.token.value = token;
		this.token.end = end;
	}
	/**
	Accept a token ending at a specific given position.
	*/
	acceptTokenTo(token, endPos) {
		this.token.value = token;
		this.token.end = endPos;
	}
	getChunk() {
		if (this.pos >= this.chunk2Pos && this.pos < this.chunk2Pos + this.chunk2.length) {
			let { chunk, chunkPos } = this;
			this.chunk = this.chunk2;
			this.chunkPos = this.chunk2Pos;
			this.chunk2 = chunk;
			this.chunk2Pos = chunkPos;
			this.chunkOff = this.pos - this.chunkPos;
		} else {
			this.chunk2 = this.chunk;
			this.chunk2Pos = this.chunkPos;
			let nextChunk = this.input.chunk(this.pos);
			let end = this.pos + nextChunk.length;
			this.chunk = end > this.range.to ? nextChunk.slice(0, this.range.to - this.pos) : nextChunk;
			this.chunkPos = this.pos;
			this.chunkOff = 0;
		}
	}
	readNext() {
		if (this.chunkOff >= this.chunk.length) {
			this.getChunk();
			if (this.chunkOff == this.chunk.length) return this.next = -1;
		}
		return this.next = this.chunk.charCodeAt(this.chunkOff);
	}
	/**
	Move the stream forward N (defaults to 1) code units. Returns
	the new value of [`next`](#lr.InputStream.next).
	*/
	advance(n = 1) {
		this.chunkOff += n;
		while (this.pos + n >= this.range.to) {
			if (this.rangeIndex == this.ranges.length - 1) return this.setDone();
			n -= this.range.to - this.pos;
			this.range = this.ranges[++this.rangeIndex];
			this.pos = this.range.from;
		}
		this.pos += n;
		if (this.pos >= this.token.lookAhead) this.token.lookAhead = this.pos + 1;
		return this.readNext();
	}
	setDone() {
		this.pos = this.chunkPos = this.end;
		this.range = this.ranges[this.rangeIndex = this.ranges.length - 1];
		this.chunk = "";
		return this.next = -1;
	}
	/**
	@internal
	*/
	reset(pos, token) {
		if (token) {
			this.token = token;
			token.start = pos;
			token.lookAhead = pos + 1;
			token.value = token.extended = -1;
		} else this.token = nullToken;
		if (this.pos != pos) {
			this.pos = pos;
			if (pos == this.end) {
				this.setDone();
				return this;
			}
			while (pos < this.range.from) this.range = this.ranges[--this.rangeIndex];
			while (pos >= this.range.to) this.range = this.ranges[++this.rangeIndex];
			if (pos >= this.chunkPos && pos < this.chunkPos + this.chunk.length) this.chunkOff = pos - this.chunkPos;
			else {
				this.chunk = "";
				this.chunkOff = 0;
			}
			this.readNext();
		}
		return this;
	}
	/**
	@internal
	*/
	read(from, to) {
		if (from >= this.chunkPos && to <= this.chunkPos + this.chunk.length) return this.chunk.slice(from - this.chunkPos, to - this.chunkPos);
		if (from >= this.chunk2Pos && to <= this.chunk2Pos + this.chunk2.length) return this.chunk2.slice(from - this.chunk2Pos, to - this.chunk2Pos);
		if (from >= this.range.from && to <= this.range.to) return this.input.read(from, to);
		let result = "";
		for (let r of this.ranges) {
			if (r.from >= to) break;
			if (r.to > from) result += this.input.read(Math.max(r.from, from), Math.min(r.to, to));
		}
		return result;
	}
};
/**
@internal
*/
var TokenGroup = class {
	constructor(data, id) {
		this.data = data;
		this.id = id;
	}
	token(input, stack) {
		let { parser } = stack.p;
		readToken(this.data, input, stack, this.id, parser.data, parser.tokenPrecTable);
	}
};
TokenGroup.prototype.contextual = TokenGroup.prototype.fallback = TokenGroup.prototype.extend = false;
/**
@hide
*/
var LocalTokenGroup = class {
	constructor(data, precTable, elseToken) {
		this.precTable = precTable;
		this.elseToken = elseToken;
		this.data = typeof data == "string" ? decodeArray(data) : data;
	}
	token(input, stack) {
		let start = input.pos, skipped = 0;
		for (;;) {
			let atEof = input.next < 0, nextPos = input.resolveOffset(1, 1);
			readToken(this.data, input, stack, 0, this.data, this.precTable);
			if (input.token.value > -1) break;
			if (this.elseToken == null) return;
			if (!atEof) skipped++;
			if (nextPos == null) break;
			input.reset(nextPos, input.token);
		}
		if (skipped) {
			input.reset(start, input.token);
			input.acceptToken(this.elseToken, skipped);
		}
	}
};
LocalTokenGroup.prototype.contextual = TokenGroup.prototype.fallback = TokenGroup.prototype.extend = false;
/**
`@external tokens` declarations in the grammar should resolve to
an instance of this class.
*/
var ExternalTokenizer = class {
	/**
	Create a tokenizer. The first argument is the function that,
	given an input stream, scans for the types of tokens it
	recognizes at the stream's position, and calls
	[`acceptToken`](#lr.InputStream.acceptToken) when it finds
	one.
	*/
	constructor(token, options = {}) {
		this.token = token;
		this.contextual = !!options.contextual;
		this.fallback = !!options.fallback;
		this.extend = !!options.extend;
	}
};
function readToken(data, input, stack, group, precTable, precOffset) {
	let state = 0, groupMask = 1 << group, { dialect } = stack.p.parser;
	scan: for (;;) {
		if ((groupMask & data[state]) == 0) break;
		let accEnd = data[state + 1];
		for (let i = state + 3; i < accEnd; i += 2) if ((data[i + 1] & groupMask) > 0) {
			let term = data[i];
			if (dialect.allows(term) && (input.token.value == -1 || input.token.value == term || overrides(term, input.token.value, precTable, precOffset))) {
				input.acceptToken(term);
				break;
			}
		}
		let next = input.next, low = 0, high = data[state + 2];
		if (input.next < 0 && high > low && data[accEnd + high * 3 - 3] == 65535) {
			state = data[accEnd + high * 3 - 1];
			continue scan;
		}
		for (; low < high;) {
			let mid = low + high >> 1;
			let index = accEnd + mid + (mid << 1);
			let from = data[index], to = data[index + 1] || 65536;
			if (next < from) high = mid;
			else if (next >= to) low = mid + 1;
			else {
				state = data[index + 2];
				input.advance();
				continue scan;
			}
		}
		break;
	}
}
function findOffset(data, start, term) {
	for (let i = start, next; (next = data[i]) != 65535; i++) if (next == term) return i - start;
	return -1;
}
function overrides(token, prev, tableData, tableOffset) {
	let iPrev = findOffset(tableData, tableOffset, prev);
	return iPrev < 0 || findOffset(tableData, tableOffset, token) < iPrev;
}
var verbose = typeof process != "undefined" && process.env && /\bparse\b/.test(process.env.LOG);
var stackIDs = null;
function cutAt(tree, pos, side) {
	let cursor = tree.cursor(IterMode.IncludeAnonymous);
	cursor.moveTo(pos);
	for (;;) if (!(side < 0 ? cursor.childBefore(pos) : cursor.childAfter(pos))) for (;;) {
		if ((side < 0 ? cursor.to < pos : cursor.from > pos) && !cursor.type.isError) return side < 0 ? Math.max(0, Math.min(cursor.to - 1, pos - 25)) : Math.min(tree.length, Math.max(cursor.from + 1, pos + 25));
		if (side < 0 ? cursor.prevSibling() : cursor.nextSibling()) break;
		if (!cursor.parent()) return side < 0 ? 0 : tree.length;
	}
}
var FragmentCursor = class {
	constructor(fragments, nodeSet) {
		this.fragments = fragments;
		this.nodeSet = nodeSet;
		this.i = 0;
		this.fragment = null;
		this.safeFrom = -1;
		this.safeTo = -1;
		this.trees = [];
		this.start = [];
		this.index = [];
		this.nextFragment();
	}
	nextFragment() {
		let fr = this.fragment = this.i == this.fragments.length ? null : this.fragments[this.i++];
		if (fr) {
			this.safeFrom = fr.openStart ? cutAt(fr.tree, fr.from + fr.offset, 1) - fr.offset : fr.from;
			this.safeTo = fr.openEnd ? cutAt(fr.tree, fr.to + fr.offset, -1) - fr.offset : fr.to;
			while (this.trees.length) {
				this.trees.pop();
				this.start.pop();
				this.index.pop();
			}
			this.trees.push(fr.tree);
			this.start.push(-fr.offset);
			this.index.push(0);
			this.nextStart = this.safeFrom;
		} else this.nextStart = 1e9;
	}
	nodeAt(pos) {
		if (pos < this.nextStart) return null;
		while (this.fragment && this.safeTo <= pos) this.nextFragment();
		if (!this.fragment) return null;
		for (;;) {
			let last = this.trees.length - 1;
			if (last < 0) {
				this.nextFragment();
				return null;
			}
			let top = this.trees[last], index = this.index[last];
			if (index == top.children.length) {
				this.trees.pop();
				this.start.pop();
				this.index.pop();
				continue;
			}
			let next = top.children[index];
			let start = this.start[last] + top.positions[index];
			if (start > pos) {
				this.nextStart = start;
				return null;
			}
			if (next instanceof Tree) {
				if (start == pos) {
					if (start < this.safeFrom) return null;
					let end = start + next.length;
					if (end <= this.safeTo) {
						let lookAhead = next.prop(NodeProp.lookAhead);
						if (!lookAhead || end + lookAhead < this.fragment.to) return next;
					}
				}
				this.index[last]++;
				if (start + next.length >= Math.max(this.safeFrom, pos)) {
					this.trees.push(next);
					this.start.push(start);
					this.index.push(0);
				}
			} else {
				this.index[last]++;
				this.nextStart = start + next.length;
			}
		}
	}
};
var TokenCache = class {
	constructor(parser, stream) {
		this.stream = stream;
		this.tokens = [];
		this.mainToken = null;
		this.actions = [];
		this.tokens = parser.tokenizers.map((_) => new CachedToken());
	}
	getActions(stack) {
		let actionIndex = 0;
		let main = null;
		let { parser } = stack.p, { tokenizers } = parser;
		let mask = parser.stateSlot(stack.state, 3);
		let context = stack.curContext ? stack.curContext.hash : 0;
		let lookAhead = 0;
		for (let i = 0; i < tokenizers.length; i++) {
			if ((1 << i & mask) == 0) continue;
			let tokenizer = tokenizers[i], token = this.tokens[i];
			if (main && !tokenizer.fallback) continue;
			if (tokenizer.contextual || token.start != stack.pos || token.mask != mask || token.context != context) {
				this.updateCachedToken(token, tokenizer, stack);
				token.mask = mask;
				token.context = context;
			}
			if (token.lookAhead > token.end + 25) lookAhead = Math.max(token.lookAhead, lookAhead);
			if (token.value != 0) {
				let startIndex = actionIndex;
				if (token.extended > -1) actionIndex = this.addActions(stack, token.extended, token.end, actionIndex);
				actionIndex = this.addActions(stack, token.value, token.end, actionIndex);
				if (!tokenizer.extend) {
					main = token;
					if (actionIndex > startIndex) break;
				}
			}
		}
		while (this.actions.length > actionIndex) this.actions.pop();
		if (lookAhead) stack.setLookAhead(lookAhead);
		if (!main && stack.pos == this.stream.end) {
			main = new CachedToken();
			main.value = stack.p.parser.eofTerm;
			main.start = main.end = stack.pos;
			actionIndex = this.addActions(stack, main.value, main.end, actionIndex);
		}
		this.mainToken = main;
		return this.actions;
	}
	getMainToken(stack) {
		if (this.mainToken) return this.mainToken;
		let main = new CachedToken(), { pos, p } = stack;
		main.start = pos;
		main.end = Math.min(pos + 1, p.stream.end);
		main.value = pos == p.stream.end ? p.parser.eofTerm : 0;
		return main;
	}
	updateCachedToken(token, tokenizer, stack) {
		let start = this.stream.clipPos(stack.pos);
		tokenizer.token(this.stream.reset(start, token), stack);
		if (token.value > -1) {
			let { parser } = stack.p;
			for (let i = 0; i < parser.specialized.length; i++) if (parser.specialized[i] == token.value) {
				let result = parser.specializers[i](this.stream.read(token.start, token.end), stack);
				if (result >= 0 && stack.p.parser.dialect.allows(result >> 1)) {
					if ((result & 1) == 0) token.value = result >> 1;
					else token.extended = result >> 1;
					break;
				}
			}
		} else {
			token.value = 0;
			token.end = this.stream.clipPos(start + 1);
		}
	}
	putAction(action, token, end, index) {
		for (let i = 0; i < index; i += 3) if (this.actions[i] == action) return index;
		this.actions[index++] = action;
		this.actions[index++] = token;
		this.actions[index++] = end;
		return index;
	}
	addActions(stack, token, end, index) {
		let { state } = stack, { parser } = stack.p, { data } = parser;
		for (let set = 0; set < 2; set++) for (let i = parser.stateSlot(state, set ? 2 : 1);; i += 3) {
			if (data[i] == 65535) {
				if (data[i + 1] == 1) i = pair(data, i + 2);
				else {
					if (index == 0 && data[i + 1] == 2) index = this.putAction(pair(data, i + 2), token, end, index);
					break;
				}
			}
			if (data[i] == token) index = this.putAction(pair(data, i + 1), token, end, index);
		}
		return index;
	}
};
var Parse = class {
	constructor(parser, input, fragments, ranges) {
		this.parser = parser;
		this.input = input;
		this.ranges = ranges;
		this.recovering = 0;
		this.nextStackID = 9812;
		this.minStackPos = 0;
		this.reused = [];
		this.stoppedAt = null;
		this.lastBigReductionStart = -1;
		this.lastBigReductionSize = 0;
		this.bigReductionCount = 0;
		this.stream = new InputStream(input, ranges);
		this.tokens = new TokenCache(parser, this.stream);
		this.topTerm = parser.top[1];
		let { from } = ranges[0];
		this.stacks = [Stack.start(this, parser.top[0], from)];
		this.fragments = fragments.length && this.stream.end - from > parser.bufferLength * 4 ? new FragmentCursor(fragments, parser.nodeSet) : null;
	}
	get parsedPos() {
		return this.minStackPos;
	}
	advance() {
		let stacks = this.stacks, pos = this.minStackPos;
		let newStacks = this.stacks = [];
		let stopped, stoppedTokens;
		if (this.bigReductionCount > 300 && stacks.length == 1) {
			let [s] = stacks;
			while (s.forceReduce() && s.stack.length && s.stack[s.stack.length - 2] >= this.lastBigReductionStart);
			this.bigReductionCount = this.lastBigReductionSize = 0;
		}
		for (let i = 0; i < stacks.length; i++) {
			let stack = stacks[i];
			for (;;) {
				this.tokens.mainToken = null;
				if (stack.pos > pos) newStacks.push(stack);
				else if (this.advanceStack(stack, newStacks, stacks)) continue;
				else {
					if (!stopped) {
						stopped = [];
						stoppedTokens = [];
					}
					stopped.push(stack);
					let tok = this.tokens.getMainToken(stack);
					stoppedTokens.push(tok.value, tok.end);
				}
				break;
			}
		}
		if (!newStacks.length) {
			let finished = stopped && findFinished(stopped);
			if (finished) {
				if (verbose) console.log("Finish with " + this.stackID(finished));
				return this.stackToTree(finished);
			}
			if (this.parser.strict) {
				if (verbose && stopped) console.log("Stuck with token " + (this.tokens.mainToken ? this.parser.getName(this.tokens.mainToken.value) : "none"));
				throw new SyntaxError("No parse at " + pos);
			}
			if (!this.recovering) this.recovering = 5;
		}
		if (this.recovering && stopped) {
			let finished = this.stoppedAt != null && stopped[0].pos > this.stoppedAt ? stopped[0] : this.runRecovery(stopped, stoppedTokens, newStacks);
			if (finished) {
				if (verbose) console.log("Force-finish " + this.stackID(finished));
				return this.stackToTree(finished.forceAll());
			}
		}
		if (this.recovering) {
			let maxRemaining = this.recovering == 1 ? 1 : this.recovering * 3;
			if (newStacks.length > maxRemaining) {
				newStacks.sort((a, b) => b.score - a.score);
				while (newStacks.length > maxRemaining) newStacks.pop();
			}
			if (newStacks.some((s) => s.reducePos > pos)) this.recovering--;
		} else if (newStacks.length > 1) {
			outer: for (let i = 0; i < newStacks.length - 1; i++) {
				let stack = newStacks[i];
				for (let j = i + 1; j < newStacks.length; j++) {
					let other = newStacks[j];
					if (stack.sameState(other) || stack.buffer.length > 500 && other.buffer.length > 500) {
						if ((stack.score - other.score || stack.buffer.length - other.buffer.length) > 0) newStacks.splice(j--, 1);
						else {
							newStacks.splice(i--, 1);
							continue outer;
						}
					}
				}
			}
			if (newStacks.length > 12) {
				newStacks.sort((a, b) => b.score - a.score);
				newStacks.splice(12, newStacks.length - 12);
			}
		}
		this.minStackPos = newStacks[0].pos;
		for (let i = 1; i < newStacks.length; i++) if (newStacks[i].pos < this.minStackPos) this.minStackPos = newStacks[i].pos;
		return null;
	}
	stopAt(pos) {
		if (this.stoppedAt != null && this.stoppedAt < pos) throw new RangeError("Can't move stoppedAt forward");
		this.stoppedAt = pos;
	}
	advanceStack(stack, stacks, split) {
		let start = stack.pos, { parser } = this;
		let base = verbose ? this.stackID(stack) + " -> " : "";
		if (this.stoppedAt != null && start > this.stoppedAt) return stack.forceReduce() ? stack : null;
		if (this.fragments) {
			let strictCx = stack.curContext && stack.curContext.tracker.strict, cxHash = strictCx ? stack.curContext.hash : 0;
			for (let cached = this.fragments.nodeAt(start); cached;) {
				let match = this.parser.nodeSet.types[cached.type.id] == cached.type ? parser.getGoto(stack.state, cached.type.id) : -1;
				if (match > -1 && cached.length && (!strictCx || (cached.prop(NodeProp.contextHash) || 0) == cxHash)) {
					stack.useNode(cached, match);
					if (verbose) console.log(base + this.stackID(stack) + ` (via reuse of ${parser.getName(cached.type.id)})`);
					return true;
				}
				if (!(cached instanceof Tree) || cached.children.length == 0 || cached.positions[0] > 0) break;
				let inner = cached.children[0];
				if (inner instanceof Tree && cached.positions[0] == 0) cached = inner;
				else break;
			}
		}
		let defaultReduce = parser.stateSlot(stack.state, 4);
		if (defaultReduce > 0) {
			stack.reduce(defaultReduce);
			if (verbose) console.log(base + this.stackID(stack) + ` (via always-reduce ${parser.getName(defaultReduce & 65535)})`);
			return true;
		}
		if (stack.stack.length >= 8400) while (stack.stack.length > 6e3 && stack.forceReduce());
		let actions = this.tokens.getActions(stack);
		for (let i = 0; i < actions.length;) {
			let action = actions[i++], term = actions[i++], end = actions[i++];
			let last = i == actions.length || !split;
			let localStack = last ? stack : stack.split();
			let main = this.tokens.mainToken;
			localStack.apply(action, term, main ? main.start : localStack.pos, end);
			if (verbose) console.log(base + this.stackID(localStack) + ` (via ${(action & 65536) == 0 ? "shift" : `reduce of ${parser.getName(action & 65535)}`} for ${parser.getName(term)} @ ${start}${localStack == stack ? "" : ", split"})`);
			if (last) return true;
			else if (localStack.pos > start) stacks.push(localStack);
			else split.push(localStack);
		}
		return false;
	}
	advanceFully(stack, newStacks) {
		let pos = stack.pos;
		for (;;) {
			if (!this.advanceStack(stack, null, null)) return false;
			if (stack.pos > pos) {
				pushStackDedup(stack, newStacks);
				return true;
			}
		}
	}
	runRecovery(stacks, tokens, newStacks) {
		let finished = null, restarted = false;
		for (let i = 0; i < stacks.length; i++) {
			let stack = stacks[i], token = tokens[i << 1], tokenEnd = tokens[(i << 1) + 1];
			let base = verbose ? this.stackID(stack) + " -> " : "";
			if (stack.deadEnd) {
				if (restarted) continue;
				restarted = true;
				stack.restart();
				if (verbose) console.log(base + this.stackID(stack) + " (restarted)");
				if (this.advanceFully(stack, newStacks)) continue;
			}
			let force = stack.split(), forceBase = base;
			for (let j = 0; j < 10 && force.forceReduce(); j++) {
				if (verbose) console.log(forceBase + this.stackID(force) + " (via force-reduce)");
				if (this.advanceFully(force, newStacks)) break;
				if (verbose) forceBase = this.stackID(force) + " -> ";
			}
			for (let insert of stack.recoverByInsert(token)) {
				if (verbose) console.log(base + this.stackID(insert) + " (via recover-insert)");
				this.advanceFully(insert, newStacks);
			}
			if (this.stream.end > stack.pos) {
				if (tokenEnd == stack.pos) {
					tokenEnd++;
					token = 0;
				}
				stack.recoverByDelete(token, tokenEnd);
				if (verbose) console.log(base + this.stackID(stack) + ` (via recover-delete ${this.parser.getName(token)})`);
				pushStackDedup(stack, newStacks);
			} else if (!finished || finished.score < force.score) finished = force;
		}
		return finished;
	}
	stackToTree(stack) {
		stack.close();
		return Tree.build({
			buffer: StackBufferCursor.create(stack),
			nodeSet: this.parser.nodeSet,
			topID: this.topTerm,
			maxBufferLength: this.parser.bufferLength,
			reused: this.reused,
			start: this.ranges[0].from,
			length: stack.pos - this.ranges[0].from,
			minRepeatType: this.parser.minRepeatTerm
		});
	}
	stackID(stack) {
		let id = (stackIDs || (stackIDs = /* @__PURE__ */ new WeakMap())).get(stack);
		if (!id) stackIDs.set(stack, id = String.fromCodePoint(this.nextStackID++));
		return id + stack;
	}
};
function pushStackDedup(stack, newStacks) {
	for (let i = 0; i < newStacks.length; i++) {
		let other = newStacks[i];
		if (other.pos == stack.pos && other.sameState(stack)) {
			if (newStacks[i].score < stack.score) newStacks[i] = stack;
			return;
		}
	}
	newStacks.push(stack);
}
var Dialect = class {
	constructor(source, flags, disabled) {
		this.source = source;
		this.flags = flags;
		this.disabled = disabled;
	}
	allows(term) {
		return !this.disabled || this.disabled[term] == 0;
	}
};
var id = (x) => x;
/**
Context trackers are used to track stateful context (such as
indentation in the Python grammar, or parent elements in the XML
grammar) needed by external tokenizers. You declare them in a
grammar file as `@context exportName from "module"`.

Context values should be immutable, and can be updated (replaced)
on shift or reduce actions.

The export used in a `@context` declaration should be of this
type.
*/
var ContextTracker = class {
	/**
	Define a context tracker.
	*/
	constructor(spec) {
		this.start = spec.start;
		this.shift = spec.shift || id;
		this.reduce = spec.reduce || id;
		this.reuse = spec.reuse || id;
		this.hash = spec.hash || (() => 0);
		this.strict = spec.strict !== false;
	}
};
/**
Holds the parse tables for a given grammar, as generated by
`lezer-generator`, and provides [methods](#common.Parser) to parse
content with.
*/
var LRParser = class LRParser extends Parser {
	/**
	@internal
	*/
	constructor(spec) {
		super();
		/**
		@internal
		*/
		this.wrappers = [];
		if (spec.version != 14) throw new RangeError(`Parser version (${spec.version}) doesn't match runtime version (14)`);
		let nodeNames = spec.nodeNames.split(" ");
		this.minRepeatTerm = nodeNames.length;
		for (let i = 0; i < spec.repeatNodeCount; i++) nodeNames.push("");
		let topTerms = Object.keys(spec.topRules).map((r) => spec.topRules[r][1]);
		let nodeProps = [];
		for (let i = 0; i < nodeNames.length; i++) nodeProps.push([]);
		function setProp(nodeID, prop, value) {
			nodeProps[nodeID].push([prop, prop.deserialize(String(value))]);
		}
		if (spec.nodeProps) for (let propSpec of spec.nodeProps) {
			let prop = propSpec[0];
			if (typeof prop == "string") prop = NodeProp[prop];
			for (let i = 1; i < propSpec.length;) {
				let next = propSpec[i++];
				if (next >= 0) setProp(next, prop, propSpec[i++]);
				else {
					let value = propSpec[i + -next];
					for (let j = -next; j > 0; j--) setProp(propSpec[i++], prop, value);
					i++;
				}
			}
		}
		this.nodeSet = new NodeSet(nodeNames.map((name, i) => NodeType.define({
			name: i >= this.minRepeatTerm ? void 0 : name,
			id: i,
			props: nodeProps[i],
			top: topTerms.indexOf(i) > -1,
			error: i == 0,
			skipped: spec.skippedNodes && spec.skippedNodes.indexOf(i) > -1
		})));
		if (spec.propSources) this.nodeSet = this.nodeSet.extend(...spec.propSources);
		this.strict = false;
		this.bufferLength = DefaultBufferLength;
		let tokenArray = decodeArray(spec.tokenData);
		this.context = spec.context;
		this.specializerSpecs = spec.specialized || [];
		this.specialized = new Uint16Array(this.specializerSpecs.length);
		for (let i = 0; i < this.specializerSpecs.length; i++) this.specialized[i] = this.specializerSpecs[i].term;
		this.specializers = this.specializerSpecs.map(getSpecializer);
		this.states = decodeArray(spec.states, Uint32Array);
		this.data = decodeArray(spec.stateData);
		this.goto = decodeArray(spec.goto);
		this.maxTerm = spec.maxTerm;
		this.tokenizers = spec.tokenizers.map((value) => typeof value == "number" ? new TokenGroup(tokenArray, value) : value);
		this.topRules = spec.topRules;
		this.dialects = spec.dialects || {};
		this.dynamicPrecedences = spec.dynamicPrecedences || null;
		this.tokenPrecTable = spec.tokenPrec;
		this.termNames = spec.termNames || null;
		this.maxNode = this.nodeSet.types.length - 1;
		this.dialect = this.parseDialect();
		this.top = this.topRules[Object.keys(this.topRules)[0]];
	}
	createParse(input, fragments, ranges) {
		let parse = new Parse(this, input, fragments, ranges);
		for (let w of this.wrappers) parse = w(parse, input, fragments, ranges);
		return parse;
	}
	/**
	Get a goto table entry @internal
	*/
	getGoto(state, term, loose = false) {
		let table = this.goto;
		if (term >= table[0]) return -1;
		for (let pos = table[term + 1];;) {
			let groupTag = table[pos++], last = groupTag & 1;
			let target = table[pos++];
			if (last && loose) return target;
			for (let end = pos + (groupTag >> 1); pos < end; pos++) if (table[pos] == state) return target;
			if (last) return -1;
		}
	}
	/**
	Check if this state has an action for a given terminal @internal
	*/
	hasAction(state, terminal) {
		let data = this.data;
		for (let set = 0; set < 2; set++) for (let i = this.stateSlot(state, set ? 2 : 1), next;; i += 3) {
			if ((next = data[i]) == 65535) {
				if (data[i + 1] == 1) next = data[i = pair(data, i + 2)];
				else if (data[i + 1] == 2) return pair(data, i + 2);
				else break;
			}
			if (next == terminal || next == 0) return pair(data, i + 1);
		}
		return 0;
	}
	/**
	@internal
	*/
	stateSlot(state, slot) {
		return this.states[state * 6 + slot];
	}
	/**
	@internal
	*/
	stateFlag(state, flag) {
		return (this.stateSlot(state, 0) & flag) > 0;
	}
	/**
	@internal
	*/
	validAction(state, action) {
		return !!this.allActions(state, (a) => a == action ? true : null);
	}
	/**
	@internal
	*/
	allActions(state, action) {
		let deflt = this.stateSlot(state, 4);
		let result = deflt ? action(deflt) : void 0;
		for (let i = this.stateSlot(state, 1); result == null; i += 3) {
			if (this.data[i] == 65535) {
				if (this.data[i + 1] == 1) i = pair(this.data, i + 2);
				else break;
			}
			result = action(pair(this.data, i + 1));
		}
		return result;
	}
	/**
	Get the states that can follow this one through shift actions or
	goto jumps. @internal
	*/
	nextStates(state) {
		let result = [];
		for (let i = this.stateSlot(state, 1);; i += 3) {
			if (this.data[i] == 65535) {
				if (this.data[i + 1] == 1) i = pair(this.data, i + 2);
				else break;
			}
			if ((this.data[i + 2] & 1) == 0) {
				let value = this.data[i + 1];
				if (!result.some((v, i) => i & 1 && v == value)) result.push(this.data[i], value);
			}
		}
		return result;
	}
	/**
	Configure the parser. Returns a new parser instance that has the
	given settings modified. Settings not provided in `config` are
	kept from the original parser.
	*/
	configure(config) {
		let copy = Object.assign(Object.create(LRParser.prototype), this);
		if (config.props) copy.nodeSet = this.nodeSet.extend(...config.props);
		if (config.top) {
			let info = this.topRules[config.top];
			if (!info) throw new RangeError(`Invalid top rule name ${config.top}`);
			copy.top = info;
		}
		if (config.tokenizers) copy.tokenizers = this.tokenizers.map((t) => {
			let found = config.tokenizers.find((r) => r.from == t);
			return found ? found.to : t;
		});
		if (config.specializers) {
			copy.specializers = this.specializers.slice();
			copy.specializerSpecs = this.specializerSpecs.map((s, i) => {
				let found = config.specializers.find((r) => r.from == s.external);
				if (!found) return s;
				let spec = Object.assign(Object.assign({}, s), { external: found.to });
				copy.specializers[i] = getSpecializer(spec);
				return spec;
			});
		}
		if (config.contextTracker) copy.context = config.contextTracker;
		if (config.dialect) copy.dialect = this.parseDialect(config.dialect);
		if (config.strict != null) copy.strict = config.strict;
		if (config.wrap) copy.wrappers = copy.wrappers.concat(config.wrap);
		if (config.bufferLength != null) copy.bufferLength = config.bufferLength;
		return copy;
	}
	/**
	Tells you whether any [parse wrappers](#lr.ParserConfig.wrap)
	are registered for this parser.
	*/
	hasWrappers() {
		return this.wrappers.length > 0;
	}
	/**
	Returns the name associated with a given term. This will only
	work for all terms when the parser was generated with the
	`--names` option. By default, only the names of tagged terms are
	stored.
	*/
	getName(term) {
		return this.termNames ? this.termNames[term] : String(term <= this.maxNode && this.nodeSet.types[term].name || term);
	}
	/**
	The eof term id is always allocated directly after the node
	types. @internal
	*/
	get eofTerm() {
		return this.maxNode + 1;
	}
	/**
	The type of top node produced by the parser.
	*/
	get topNode() {
		return this.nodeSet.types[this.top[1]];
	}
	/**
	@internal
	*/
	dynamicPrecedence(term) {
		let prec = this.dynamicPrecedences;
		return prec == null ? 0 : prec[term] || 0;
	}
	/**
	@internal
	*/
	parseDialect(dialect) {
		let values = Object.keys(this.dialects), flags = values.map(() => false);
		if (dialect) for (let part of dialect.split(" ")) {
			let id = values.indexOf(part);
			if (id >= 0) flags[id] = true;
		}
		let disabled = null;
		for (let i = 0; i < values.length; i++) if (!flags[i]) for (let j = this.dialects[values[i]], id; (id = this.data[j++]) != 65535;) (disabled || (disabled = new Uint8Array(this.maxTerm + 1)))[id] = 1;
		return new Dialect(dialect, flags, disabled);
	}
	/**
	Used by the output of the parser generator. Not available to
	user code. @hide
	*/
	static deserialize(spec) {
		return new LRParser(spec);
	}
};
function pair(data, off) {
	return data[off] | data[off + 1] << 16;
}
function findFinished(stacks) {
	let best = null;
	for (let stack of stacks) {
		let stopped = stack.p.stoppedAt;
		if ((stack.pos == stack.p.stream.end || stopped != null && stack.pos > stopped) && stack.p.parser.stateFlag(stack.state, 2) && (!best || best.score < stack.score)) best = stack;
	}
	return best;
}
function getSpecializer(spec) {
	if (spec.external) {
		let mask = spec.extend ? 1 : 0;
		return (value, stack) => spec.external(value, stack) << 1 | mask;
	}
	return spec.get;
}
//#endregion
//#region node_modules/@lezer/css/dist/index.js
var descendantOp = 148;
var Unit = 1;
var identifier$1 = 149;
var callee = 150;
var VariableName = 2;
var queryIdentifier = 151;
var queryVariableName = 3;
var QueryCallee = 4;
var space = [
	9,
	10,
	11,
	12,
	13,
	32,
	133,
	160,
	5760,
	8192,
	8193,
	8194,
	8195,
	8196,
	8197,
	8198,
	8199,
	8200,
	8201,
	8202,
	8232,
	8233,
	8239,
	8287,
	12288
];
var colon = 58;
var parenL = 40;
var underscore = 95;
var bracketL = 91;
var dash = 45;
var period = 46;
var hash = 35;
var percent = 37;
var ampersand = 38;
var backslash = 92;
var newline = 10;
var asterisk = 42;
function isAlpha(ch) {
	return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122 || ch >= 161;
}
function isDigit(ch) {
	return ch >= 48 && ch <= 57;
}
function isHex(ch) {
	return isDigit(ch) || ch >= 97 && ch <= 102 || ch >= 65 && ch <= 70;
}
var identifierTokens = (id, varName, callee) => (input, stack) => {
	for (let inside = false, dashes = 0, i = 0;; i++) {
		let { next } = input;
		if (isAlpha(next) || next == dash || next == underscore || inside && isDigit(next)) {
			if (!inside && (next != dash || i > 0)) inside = true;
			if (dashes === i && next == dash) dashes++;
			input.advance();
		} else if (next == backslash && input.peek(1) != newline) {
			input.advance();
			if (isHex(input.next)) {
				do
					input.advance();
				while (isHex(input.next));
				if (input.next == 32) input.advance();
			} else if (input.next > -1) input.advance();
			inside = true;
		} else {
			if (inside) input.acceptToken(dashes == 2 && stack.canShift(VariableName) ? varName : next == parenL ? callee : id);
			break;
		}
	}
};
var identifiers = new ExternalTokenizer(identifierTokens(identifier$1, VariableName, callee), { contextual: true });
var queryIdentifiers = new ExternalTokenizer(identifierTokens(queryIdentifier, queryVariableName, QueryCallee), { contextual: true });
var descendant = new ExternalTokenizer((input) => {
	if (space.includes(input.peek(-1))) {
		let { next } = input;
		if (isAlpha(next) || next == underscore || next == hash || next == period || next == asterisk || next == bracketL || next == colon && isAlpha(input.peek(1)) || next == dash || next == ampersand) input.acceptToken(descendantOp);
	}
});
var unitToken = new ExternalTokenizer((input) => {
	if (!space.includes(input.peek(-1))) {
		let { next } = input;
		if (next == percent) {
			input.advance();
			input.acceptToken(Unit);
		}
		if (isAlpha(next)) {
			do
				input.advance();
			while (isAlpha(input.next) || isDigit(input.next));
			input.acceptToken(Unit);
		}
	}
});
var cssHighlighting = styleTags({
	"AtKeyword import charset namespace keyframes media supports font-feature-values": tags$1.definitionKeyword,
	"from to selector scope MatchFlag": tags$1.keyword,
	NamespaceName: tags$1.namespace,
	KeyframeName: tags$1.labelName,
	KeyframeRangeName: tags$1.operatorKeyword,
	TagName: tags$1.tagName,
	ClassName: tags$1.className,
	PseudoClassName: tags$1.constant(tags$1.className),
	IdName: tags$1.labelName,
	"FeatureName PropertyName": tags$1.propertyName,
	AttributeName: tags$1.attributeName,
	NumberLiteral: tags$1.number,
	KeywordQuery: tags$1.keyword,
	UnaryQueryOp: tags$1.operatorKeyword,
	"CallTag ValueName FontName": tags$1.atom,
	VariableName: tags$1.variableName,
	Callee: tags$1.operatorKeyword,
	Unit: tags$1.unit,
	"UniversalSelector NestingSelector": tags$1.definitionOperator,
	"MatchOp CompareOp": tags$1.compareOperator,
	"ChildOp SiblingOp, LogicOp": tags$1.logicOperator,
	BinOp: tags$1.arithmeticOperator,
	Important: tags$1.modifier,
	Comment: tags$1.blockComment,
	ColorLiteral: tags$1.color,
	"ParenthesizedContent StringLiteral": tags$1.string,
	":": tags$1.punctuation,
	"PseudoOp #": tags$1.derefOperator,
	"; , |": tags$1.separator,
	"( )": tags$1.paren,
	"[ ]": tags$1.squareBracket,
	"{ }": tags$1.brace
});
var spec_callee = {
	__proto__: null,
	lang: 44,
	"nth-child": 44,
	"nth-last-child": 44,
	"nth-of-type": 44,
	"nth-last-of-type": 44,
	dir: 44,
	"host-context": 44,
	if: 90,
	url: 158,
	"url-prefix": 158,
	domain: 158,
	regexp: 158
};
var spec_queryIdentifier = {
	__proto__: null,
	or: 104,
	and: 104,
	not: 112,
	only: 112,
	layer: 212
};
var spec_QueryCallee = {
	__proto__: null,
	selector: 118,
	style: 124,
	layer: 208
};
var spec_AtKeyword = {
	__proto__: null,
	"@import": 204,
	"@media": 216,
	"@charset": 220,
	"@namespace": 224,
	"@keyframes": 230,
	"@supports": 242,
	"@scope": 246,
	"@font-feature-values": 252
};
var spec_identifier = {
	__proto__: null,
	to: 249
};
var parser = LRParser.deserialize({
	version: 14,
	states: "MrQYQdOOO#}QdOOP$UO`OOO%OQaO'#CfOOQP'#Ce'#CeO%VQdO'#CgO%[Q`O'#CgO%aQaO'#FqO&XQdO'#CkO&xQaO'#CcO'SQdO'#CnO'_QdO'#ERO'dQdO'#ETO'oQdO'#E[O'oQdO'#E_OOQP'#Fq'#FqO)RQhO'#FQOOQS'#Fp'#FpOOQS'#FT'#FTQYQdOOO)YQdO'#EeO*iQhO'#EkO)YQdO'#EmO*pQdO'#EoO*{QdO'#ErO)}QhO'#ExO+TQdO'#EzO+`QdO'#E}O+eQaO'#CfO+lQ`O'#EbO+qQ`O'#F}O+|QdO'#F}QOQ`OOP,WO&jO'#CaPOOO)CA`)CA`OOQP'#Ci'#CiOOQP,59R,59RO%VQdO,59ROOQP'#Cm'#CmOOQP,59V,59VO&XQdO,59VO,cQdO,59YO'_QdO,5:mO'dQdO,5:oO'oQdO,5:vO'oQdO,5:xO'oQdO,5:yO'oQdO'#F[O,nQ`O,58}O,vQdO'#EaOOQS,58},58}OOQP'#Cq'#CqOOQO'#EP'#EPOOQP,59Y,59YO,}Q`O,59YO-SQ`O,59YOOQP'#ES'#ESOOQP,5:m,5:mO-XQpO'#EUO-dQdO'#EVO-iQ`O'#EVO-nQpO,5:oO.XQaO,5:vO.oQaO,5:yOOQW'#D^'#D^O/nQhO'#DgO0RQhO,5;lO)}QhO'#DeO0`Q`O'#DnO0eQhO'#D{OOQW'#Fw'#FwOOQS,5;l,5;lO0jQ`O'#DhO0oQ`O'#DkOOQS-E9R-E9ROOQ['#Cv'#CvO0tQdO'#CwO1[QdO'#C}O1rQdO'#DQO2YQ!pO'#DSO4fQ!jO,5;POOQO'#DX'#DXO-SQ`O'#DWO4vQ!nO'#FtO6|Q`O'#DYO7RQ`O'#D|OOQ['#Ft'#FtO7WQhO'#GQO7fQ`O,5;VO7kQ!bO,5;XOOQS'#Eq'#EqO7sQ`O,5;ZO7xQdO,5;ZOOQO'#Et'#EtO8QQ`O,5;^O8VQhO,5;dO'oQdO'#DjOOQS,5;f,5;fO0jQ`O,5;fO8_QdO,5;fOOQS'#Fc'#FcO8gQdO'#FPO7fQ`O,5;iO8oQdO,5:|O9PQdO'#F^O9^Q`O,5<iO9^Q`O,5<iPOOO'#FS'#FSP9iO&jO,58{POOO,58{,58{OOQP1G.m1G.mOOQP1G.q1G.qOOQP1G.t1G.tO,}Q`O1G.tO-SQ`O1G.tOOQP1G0X1G0XO9tQpO1G0ZO9|QaO1G0bO:dQaO1G0dO:zQaO1G0eO;bQaO,5;vOOQO-E9Y-E9YOOQS1G.i1G.iO;lQ`O,5:{O;qQdO'#EQO;xQdO'#CuOOQO'#EX'#EXOOQO,5:q,5:qO-dQdO,5:qOOQP1G0Z1G0ZO)YQdO1G0ZO<PQ!jO'#D^O<_Q!bO,59yO<gQhO,5:ROOQO'#Fx'#FxO<bQ!bO,59}O<oQhO'#FdO)}QhO,59{O)}QhO'#FdO=gQhO1G1WOOQS1G1W1G1WO=qQhO,5:PO>lQhO'#DoOOQW,5:Y,5:YOOQW,5:g,5:gOOQW,5:S,5:SO>vQhO,5:VO?bQ!fO'#FuOOQS'#Fu'#FuOOQS'#FV'#FVO@rQdO,59cOOQ[,59c,59cOAYQdO,59iOOQ[,59i,59iOApQdO,59lOOQ[,59l,59lOOQ[,59n,59nO)YQdO,59pOBWQhO'#EgOOQW'#Eg'#EgOBuQ`O1G0kO4oQhO1G0kOOQ[,59r,59rO)}QhO'#D[OOQ[,59t,59tOBzQ#tO,5:hOCVQhO'#F`OCdQ`O,5<lOOQS1G0q1G0qOOQS1G0s1G0sOOQS1G0u1G0uOCoQ`O1G0uOCtQdO'#EuOOQS1G0x1G0xOOQS1G1O1G1OODPQaO,5:UO7fQ`O1G1QOOQS1G1Q1G1QO0jQ`O1G1QOOQS-E9a-E9aOOQS1G1T1G1TODWQ!fO1G0hODnQ`O'#EdOOQO1G0h1G0hOOQO,5;x,5;xODsQdO,5;xOOQO-E9[-E9[OEQQ`O1G2TPOOO-E9Q-E9QPOOO1G.g1G.gOOQP7+$`7+$`OOQP7+%u7+%uO)YQdO7+%uOOQS1G0g1G0gOE]QaO'#F|OEgQ`O,5:lOElQ!fO'#FUOFjQdO'#FsOFtQ`O,59aOOQO1G0]1G0]OFyQ!bO7+%uO)YQdO1G/eOGUQhO1G/iOOQW1G/m1G/mOOQW1G/g1G/gOGgQhO,5<OOOQW-E9b-E9bOOQS7+&r7+&rOH_QhO'#D^OHmQhO'#F{OHxQ`O'#F{OH}Q`O,5:ZOISQ!bO'#D`O>vQhO'#DmOI_QhO'#DsOIgQhO'#DuOIlQ!jO'#FzOOQO'#Fz'#FzOIwQ`O'#DxOJPQ!bO'#DzOOQO'#Fy'#FyOJUQ`O1G/qOOQS-E9T-E9TOOQ[1G.}1G.}OOQ[1G/T1G/TOOQ[1G/W1G/WOOQ[1G/[1G/[OJZQdO,5;ROOQS7+&V7+&VOJ`Q`O7+&VOJeQhO'#D]OJmQ`O,59vO)}QhO,59vOOQ[1G0S1G0SOJuQ`O1G0SOJzQhO,5;zOOQO-E9^-E9^OOQS7+&a7+&aOKYQbO'#DSOOQO'#Ew'#EwOKhQ`O'#EvOOQO'#Ev'#EvOKsQ`O'#FaOK{QdO,5;aOOQS,5;a,5;aOOQ[1G/p1G/pOOQS7+&l7+&lO7fQ`O7+&lOLWQ!fO'#F]O)YQdO'#F]OM_QdO7+&SOOQO7+&S7+&SOOQO,5;O,5;OOOQO1G1d1G1dOMrQ!bO<<IaOM}QdO'#FZONXQ`O,5<hOOQP1G0W1G0WOOQS-E9S-E9SONaQdO'#FYONkQ`O,5<_OOQ]1G.{1G.{OOQP<<Ia<<IaONsQ`O<<IaONxQdO7+%POOQO'#D`'#D`O! PQ!bO7+%TO! XQhO'#FXO! fQ`O,5<gO)YQdO,5<gOOQW1G/u1G/uO! nQ`O,5:XO>vQhO'#DtOOQO,5:_,5:_O! sQhO,5:aO! {QhO,5:fO)YQdO,5:dOOQW7+%]7+%]OOQO'#Ei'#EiO!!SQ`O1G0mOOQS<<Iq<<IqO)YQdO,59wO!!vQhO1G/bOOQ[1G/b1G/bO!!}Q`O1G/bOOQW-E9U-E9UOOQ[7+%n7+%nOOQO,5;b,5;bOCwQdO'#FbOKsQ`O,5;{OOQS,5;{,5;{OOQS-E9_-E9_OOQS1G0{1G0{OOQS<<JW<<JWO!#VQ!fO,5;wOOQS-E9Z-E9ZOOQO<<In<<InOOQPAN>{AN>{O!$^Q`OAN>{O!$cQaO,5;uOOQO-E9X-E9XO!$mQdO,5;tOOQO-E9W-E9WOOQW<<Hk<<HkOOQW<<Ho<<HoO!$wQhO<<HoO!%YQhO'#D^O!%hQhO,5;sO!%sQ`O,5;sOOQO-E9V-E9VO!%xQdO1G2RO!&SQhO1G/sO!&[Q`O,5:`O>vQhO'#DwOOQO1G/{1G/{O!&aQ!bO1G0QO!&iQdO1G0OOJZQdO'#F_O!&pQ`O7+&XOOQW7+&X7+&XO!&xQ!bO1G/cOOQ[7+$|7+$|O!'TQhO7+$|P!'[Q`O'#FWOOQO,5;|,5;|OOQO-E9`-E9`OOQS1G1g1G1gOOQPG24gG24gO!'aQ`OAN>ZO)YQdO1G1_O!'fQ`O7+'mOOQO1G/z1G/zO!'nQ`O,5:cO!'sQhO7+%lOOQO,5;y,5;yOOQO-E9]-E9]OOQW<<Is<<IsOOQ[<<Hh<<HhPOQW,5;r,5;rOOQWG23uG23uO!'zQdO7+&yOOQO1G/}1G/}OOQO<<IW<<IW",
	stateData: "!(_~O$_OS$`QQ~OWVO^_O`WOcYOdYOl`OmZOp[O#P]O#S^O#YdO#`eO#bfO#dgO#ghO#miO#ojO#rkO$ZRO$fTO~OQmOWVO^_O`WOcYOdYOl`OmZOp[O#P]O#S^O#YdO#`eO#bfO#dgO#ghO#miO#ojO#rkO$ZlO$fTO~O$X$qP~P!jO$`qO~O`YXcYXdYXmYXpYXsYX!eYX#PYX#SYX$YYX$f[X~OgYX~P$ZO$ZsO~O$fuO~O$fuO`$eXc$eXd$eXm$eXp$eXs$eX!e$eX#P$eX#S$eX$Y$eXg$eX~O$ZvO~O`xOcyOdyOmzOp{O#P|O#S!OO$Y}O~Os!RO!e!PO~P&^Of!XO$Z!TO$[!UO~O$Z!YO~OW!^O$Z![O$f!]O~OWVO^_O`WOcYOdYOmZOp[O#P]O#S^O$ZRO$fTO~OS!fOc!gOd!gOh!cOs!RO!Y!eO!]!jO!`!kO$]!bO~On!iO~P(dOQ!uOh!nOp!oOs!pOu!xOw!xO}!vO!q!wO$Z!mO$[!sO$j!qO~OS!fOc!gOd!gOh!cO!Y!eO!]!jO!`!kO$]!bO~Os$tP~P)}Ow!}O!q!wO$Z!|O~Ow#PO$Z#PO~Oh#SOs!RO#p#UO~O$Z#WO~Oc#VX~P$ZOc#ZO~On#[O$X$qXr$qX~O$X$qXr$qX~P!jO$a#_O$b#_O$c#aO~Of#fO$Z!TO$[!UO~Os!RO!e!PO~Or$qP~P!jOh#pO~Oh#qO~Oo!xX!|!xX$f!zX~O$Z#rO~O$f#tO~Oo#uO!|#vO~O`xOcyOdyOmzOp{O~Os#Oa!e#Oa#P#Oa#S#Oa$Y#Oag#Oa~P-vOs#Ra!e#Ra#P#Ra#S#Ra$Y#Rag#Ra~P-vOS!fOc!gOd!gOh!cO!Y!eO!]!jO!`!kO~OR#zOu#zOw#zO$]#wO$j!qO~P/VOn$QO!U#}O!e$OO~P(dOh$SO~O$]$UO~Oh#SO~Oh$WO~O`$YOc$YOg$]Ol$YOm$YOn$YO~P)YO`$YOc$YOl$YOm$YOn$YOo$_O~P)YO`$YOc$YOl$YOm$YOn$YOr$aO~P)YOP$bOSvXcvXdvXhvXnvXyvX!YvX!]vX!`vX#[vX#^vX$]vX!WvXQvX`vXgvXlvXmvXpvXsvXuvXwvX}vX!qvX$ZvX$[vX$jvXovXrvX!evX$XvX$svX!}vX~Oy$cO#[$dO#^$eOn$tP~P)}Oh#qOS$hXc$hXd$hXn$hXy$hX!Y$hX!]$hX!`$hX#[$hX#^$hX$]$hXQ$hX`$hXg$hXl$hXm$hXp$hXs$hXu$hXw$hX}$hX!q$hX$Z$hX$[$hX$j$hXo$hXr$hX!e$hX$X$hX$s$hX!}$hX~Oh$iO~Oh$kO~O!U#}O!e$lOs$tXn$tX~Os!RO~On$oOy$cO~On$pO~Ow$qO!q!wO~Os$rO~Os!RO!U#}O~Os!RO#p$xO~O$Z#WOs#sX~O$s$|On#Ua$X#Uar#Ua~P)YOn$QX$X$QXr$QX~P!jOn#[O$X$qar$qa~O$a#_O$b#_O$c%TO~Oo%VO!|%WO~Os#Oi!e#Oi#P#Oi#S#Oi$Y#Oig#Oi~P-vOs#Qi!e#Qi#P#Qi#S#Qi$Y#Qig#Qi~P-vOs#Ri!e#Ri#P#Ri#S#Ri$Y#Rig#Ri~P-vOs$Oa!e$Oa~P&^Or%XO~Og$pP~P'oOg$gP~P)YOc!SXg!QX!U!QX!W!SX~Oc%aO!W%bO~Og%cO!U#}O~O!U#}OS$WXc$WXd$WXh$WXn$WXs$WX!Y$WX!]$WX!`$WX!e$WX$]$WX~On%gO!e$OO~P(dO!U#}OS!Xac!Xad!Xah!Xan!Xas!Xa!Y!Xa!]!Xa!`!Xa!e!Xa$]!Xag!Xa~O$]%hOg$oP~P/VOR#zOS!fOh%mOu#zOw#zO!Y%nO$]%lO$j!qO~Oy$cOQ$iX`$iXc$iXg$iXh$iXl$iXm$iXn$iXp$iXs$iXu$iXw$iX}$iX!q$iX$Z$iX$[$iX$j$iXo$iXr$iX~O`$YOc$YOg%wOl$YOm$YOn$YO~P)YO`$YOc$YOl$YOm$YOn$YOo%xO~P)YO`$YOc$YOl$YOm$YOn$YOr%yO~P)YOh%{OS#ZXc#ZXd#ZXn#ZX!Y#ZX!]#ZX!`#ZX$]#ZX~On%|O~Og&ROw&SO!r&SO~Os$SX!e$SXn$SX~P)}O!e$lOs$tan$ta~On&VO~Or&^O$Z&XO$j&WO~Og&_O~P&^Oy$cO!e&cO$s$|On#Ui$X#Uir#Ui~P)YO$r&fO~On$Qa$X$Qar$Qa~P!jOn#[O$X$qir$qi~O!e&iOg$pX~P&^Og&kO~Oy$cOQ#xXg#xXh#xXp#xXs#xXu#xXw#xX}#xX!e#xX!q#xX$Z#xX$[#xX$j#xX~O!e&mOg$gX~P)YOg&oO~Oo&pOy$cO!}&qO~OR#zOu#zOw#zO$]&sO$j!qO~O!U#}OS$Wac$Wad$Wah$Wan$Was$Wa!Y$Wa!]$Wa!`$Wa!e$Wa$]$Wa~Oc!dXg!QX!U!QX!e!QX~O!U#}O!e&uOg$oX~Oc&wO~Og&xO~Oc!mXg!mX!W!SX~OS!fOh&zO~O!U&|O~O!U&|O!W&}Og$nX~Oc'OOg!lX~O!W&}O~Og'PO~O$Z'QO~On'SO~Oc'TO!U#}O~Og'VOn'UO~Og'YO~O!U#}Os$Sa!e$San$Sa~OP$bOsvX!evXgvX~O$j&WOs#jX!e#jX~Os!RO!e'[O~Or'`O$Z&XO$j&WO~Oy$cOQ$PXh$PXn$PXp$PXs$PXu$PXw$PX}$PX!e$PX!q$PX$X$PX$Z$PX$[$PX$j$PX$s$PXr$PX~O!e&cO$s$|On#Uq$X#Uqr#Uq~P)YOo'eOy$cO!}'fO~Og#}X!e#}X~P'oO!e&iOg$pa~Og#|X!e#|X~P)YO!e&mOg$ga~Oo'eO~Og'kO~P)YOg'lO!W'mO~O$]'nOg#{X!e#{X~P/VO!e&uOg$oa~Og'sO~OS!fOh'uO~OS!fO~PGUO`'yOg'{O~OS#zac#zad#zah#za!Y#za!]#za!`#za$]#za~Og'}O~P!![Og'}On(OO~Oy$cOQ$Pah$Pan$Pap$Pas$Pau$Paw$Pa}$Pa!e$Pa!q$Pa$X$Pa$Z$Pa$[$Pa$j$Pa$s$Par$Pa~Oo(TO~Og#}a!e#}a~P&^Og#|a!e#|a~P)YOR#zOu#zOw#zO$]&sO$j&WO~Oc!fXg!QX!U!QX!e!QX~O!U#}Og#{a!e#{a~Oc(VO~O!e&uOg$oi~P)YOg!ai!U!ji~Og(XO~O!W(ZOg!ni~Og!li~P)YO`'yOg(^O~Oy$cOg!Pin!Pi~Og(_O~P!![On(`O~Og(aO~O!e&uOg$oq~Og(cO~OS!fO~P!$wOg#{q!e#{q~P)YO$_!r$`$j`$jy#S~",
	goto: "7g$uPPPPP$vP$yP%S%f%S%x&[P%SP&b%SPP&hPPP&n&x&xPPPPP&xPP&xP'hP&xP&x(k&xP)Z)^)d)d)v)dP)dP)dP)d)dP*])dP*i*o+e+hP+k*i+n*i+q+w+z,Q+z)d,WPP,|-S%S-Y%S-`-`-f-jPP%SP%S%SP-p.l.y/Q$yP/ZP/^P$yP$yP$yP/d$yP/g/j/m/t$yP$yPP$yP/y$yP/|0S0c0}1]1c1m1s1y2P2V2a2g2m2s2y3PPPPPPPPPPPP3V3`P4U4X5]P5e6_6t+z7Q7T7WPP7^RrQ_aOPco!R#[%Pq_OP]^co|}!O!P!R#S#[#p%P&iqSOP]^co|}!O!P!R#S#[#p%P&iqUOP]^co|}!O!P!R#S#[#p%P&iQtTR#buQwWR#cxQ!VYR#dyQ#d!XS$h!t!uR%U#f!Z!xdf!n!o!p#Z#q#v$[$^$`$c${%W%]%a&c&d&m&r&w'O'T'i'r'x(V(b!Y!xdf!n!o!p#Z#q#v$[$^$`$c${%W%]%a&c&d&m&r&w'O'T'i'r'x(V(bb#z!c$W%b%m&z&}'m'u(ZU&Z$r&]'[R'Z&Y!Z!tdf!n!o!p#Z#q#v$[$^$`$c${%W%]%a&c&d&m&r&w'O'T'i'r'x(V(bR$j!vQ&P$iR'W&Qq!h`ei!c!d!e!r#}$O$P$S$g$i$l&Q&uQ#x!cW%s$W%m&z'uQ&t%bQ'w&}Q(U'mR(d(ZQ#VjQ$V!jQ$v#UR&a$xX%q$W%m&z'up!h`ei!c!d!e!r#}$O$P$S$g$i$l&Q&uW%p$W%m&z'uQ&{%nQ'v&|Q'w&}R(d(ZR$T!fR%j$SR'p&uR&{%nX%o$W%m&z'uR'v&|X%t$W%m&z'uX%r$W%m&z'u!Y!xdf!n!o!p#Z#q#v$[$^$`$c${%W%]%a&c&d&m&r&w'O'T'i'r'x(V(bQ!}gR$q#OQ!WYR#eyQ#d!WR%U#eQ!ZZR#gzQ!_[R#h{T!^[{Q#s!]R%_#tQ!SXQ!i`Q#TjQ#n!QQ$Q!dQ$n!zQ$t#RQ$w#VQ$z#YQ%g$PQ&`$vQ'^&[Q'a&aR(S']SnP!RQ#^oQ%O#[R&g%PZmPo!R#[%PQ$}#ZQ&e${R'd&dR$g!rQ'R%{R(['yR#OgR#QhR$s#QS&[$r&]R(Q'[V&Y$r&]'[R#YkQ#`qR%S#`QcOSoP!RU!lco%PR%P#[Q%]#q[&l%]&r'i'r'x(bQ&r%aQ'i&mQ'r&wQ'x'OR(b(VQ$[!nQ$^!oQ$`!pV%v$[$^$`Q&Q$iR'X&QQ&v%iS'q&v(WR(W'rQ&n%]R'j&nQ&j%YR'h&jQ!QXR#m!QQ&d${R'c&dQ#]nS%Q#]%RR%R#^Q'z'RR(]'zQ$m!yR&U$mQ&]$rR'_&]Q']&[R(R']Q#XkR$y#XQ$P!dR%f$P_bOPco!R#[%P^XOPco!R#[%PQ!`]Q!a^Q#i|Q#j}Q#k!OQ#l!PQ$u#SQ%Y#pR'g&iR%^#qQ!rdQ!{f[$X!n!o!p$[$^$`Q${#Zh%[#q%]%a&m&r&w'O'i'r'x(V(bQ%`#vQ%z$cS&b${&dQ&h%WQ'b&cR'|'T]$Z!n!o!p$[$^$`Q!d`U!ye!r$gQ#RiQ#y!cS#|!d$PQ$R!eQ%d#}Q%e$OQ%i$SS&O$i&QQ&T$lR'o&uQ#{!cW%s$W%m&z'uQ&t%bQ'w&}Q(U'mR(d(ZQ%u$WQ&y%mQ't&zR(Y'uR%k$SR%Z#pQpPR#o!RQ!zeQ$f!rR%}$g",
	nodeNames: "⚠ Unit VariableName VariableName QueryCallee Comment StyleSheet RuleSet UniversalSelector TagSelector TagName NamespacedTagSelector NamespaceName TagName NestingSelector ClassSelector . ClassName PseudoClassSelector : :: PseudoClassName PseudoClassName ) ( ArgList ValueName ParenthesizedValue AtKeyword # ; ] [ BracketedValue } { BracedValue ColorLiteral NumberLiteral StringLiteral BinaryExpression BinOp CallExpression Callee IfExpression if ArgList IfBranch KeywordQuery FeatureQuery FeatureName BinaryQuery LogicOp ComparisonQuery CompareOp UnaryQuery UnaryQueryOp ParenthesizedQuery SelectorQuery selector ParenthesizedSelector StyleQuery style ParenthesedQuery CallQuery ArgList PropertyName , PropertyName UnaryQuery ParenthesedQuery BinaryQuery ParenthesedQuery ParenthesedQuery StyleFeature PropertyName StyleRange PseudoQuery CallLiteral CallTag ParenthesizedContent PseudoClassName ArgList IdSelector IdName AttributeSelector AttributeName NamespacedAttribute NamespaceName AttributeName MatchOp MatchFlag ChildSelector ChildOp DescendantSelector SiblingSelector SiblingOp Block Declaration PropertyName Important ImportStatement import Layer layer LayerName layer MediaStatement media CharsetStatement charset NamespaceStatement namespace NamespaceName KeyframesStatement keyframes KeyframeName KeyframeList KeyframeSelector KeyframeRangeName SupportsStatement supports ScopeStatement scope to FontFeatureStatement font-feature-values FontName AtRule Styles",
	maxTerm: 174,
	nodeProps: [
		[
			"isolate",
			-2,
			5,
			39,
			""
		],
		[
			"openedBy",
			23,
			"(",
			31,
			"[",
			34,
			"{"
		],
		[
			"closedBy",
			24,
			")",
			32,
			"]",
			35,
			"}"
		]
	],
	propSources: [cssHighlighting],
	skippedNodes: [
		0,
		5,
		130
	],
	repeatNodeCount: 17,
	tokenData: "K`~R!bOX%ZX^&R^p%Zpq&Rqr)ers)vst+jtu2Xuv%Zvw3Rwx3dxy5Ryz5dz{5i{|6S|}:u}!O;W!O!P;u!P!Q<^!Q![=V![!]>Q!]!^>|!^!_?_!_!`@Z!`!a@n!a!b%Z!b!cAo!c!k%Z!k!lC|!l!u%Z!u!vC|!v!}%Z!}#OD_#O#P%Z#P#QDp#Q#R2X#R#]%Z#]#^ER#^#g%Z#g#hC|#h#o%Z#o#pIf#p#qIw#q#rJ`#r#sJq#s#y%Z#y#z&R#z$f%Z$f$g&R$g#BY%Z#BY#BZ&R#BZ$IS%Z$IS$I_&R$I_$I|%Z$I|$JO&R$JO$JT%Z$JT$JU&R$JU$KV%Z$KV$KW&R$KW&FU%Z&FU&FV&R&FV;'S%Z;'S;=`KY<%lO%Z`%^SOy%jz;'S%j;'S;=`%{<%lO%j`%oS!r`Oy%jz;'S%j;'S;=`%{<%lO%j`&OP;=`<%l%j~&Wh$_~OX%jX^'r^p%jpq'rqy%jz#y%j#y#z'r#z$f%j$f$g'r$g#BY%j#BY#BZ'r#BZ$IS%j$IS$I_'r$I_$I|%j$I|$JO'r$JO$JT%j$JT$JU'r$JU$KV%j$KV$KW'r$KW&FU%j&FU&FV'r&FV;'S%j;'S;=`%{<%lO%j~'yh$_~!r`OX%jX^'r^p%jpq'rqy%jz#y%j#y#z'r#z$f%j$f$g'r$g#BY%j#BY#BZ'r#BZ$IS%j$IS$I_'r$I_$I|%j$I|$JO'r$JO$JT%j$JT$JU'r$JU$KV%j$KV$KW'r$KW&FU%j&FU&FV'r&FV;'S%j;'S;=`%{<%lO%jj)jS$sYOy%jz;'S%j;'S;=`%{<%lO%j~)yWOY)vZr)vrs*cs#O)v#O#P*h#P;'S)v;'S;=`+d<%lO)v~*hOw~~*kRO;'S)v;'S;=`*t;=`O)v~*wXOY)vZr)vrs*cs#O)v#O#P*h#P;'S)v;'S;=`+d;=`<%l)v<%lO)v~+gP;=`<%l)vj+oYmYOy%jz!Q%j!Q![,_![!c%j!c!i,_!i#T%j#T#Z,_#Z;'S%j;'S;=`%{<%lO%jj,dY!r`Oy%jz!Q%j!Q![-S![!c%j!c!i-S!i#T%j#T#Z-S#Z;'S%j;'S;=`%{<%lO%jj-XY!r`Oy%jz!Q%j!Q![-w![!c%j!c!i-w!i#T%j#T#Z-w#Z;'S%j;'S;=`%{<%lO%jj.OYuY!r`Oy%jz!Q%j!Q![.n![!c%j!c!i.n!i#T%j#T#Z.n#Z;'S%j;'S;=`%{<%lO%jj.uYuY!r`Oy%jz!Q%j!Q![/e![!c%j!c!i/e!i#T%j#T#Z/e#Z;'S%j;'S;=`%{<%lO%jj/jY!r`Oy%jz!Q%j!Q![0Y![!c%j!c!i0Y!i#T%j#T#Z0Y#Z;'S%j;'S;=`%{<%lO%jj0aYuY!r`Oy%jz!Q%j!Q![1P![!c%j!c!i1P!i#T%j#T#Z1P#Z;'S%j;'S;=`%{<%lO%jj1UY!r`Oy%jz!Q%j!Q![1t![!c%j!c!i1t!i#T%j#T#Z1t#Z;'S%j;'S;=`%{<%lO%jj1{SuY!r`Oy%jz;'S%j;'S;=`%{<%lO%jd2[UOy%jz!_%j!_!`2n!`;'S%j;'S;=`%{<%lO%jd2uS!|S!r`Oy%jz;'S%j;'S;=`%{<%lO%jb3WS^QOy%jz;'S%j;'S;=`%{<%lO%j~3gWOY3dZw3dwx*cx#O3d#O#P4P#P;'S3d;'S;=`4{<%lO3d~4SRO;'S3d;'S;=`4];=`O3d~4`XOY3dZw3dwx*cx#O3d#O#P4P#P;'S3d;'S;=`4{;=`<%l3d<%lO3d~5OP;=`<%l3dj5WShYOy%jz;'S%j;'S;=`%{<%lO%j~5iOg~n5pUWQyWOy%jz!_%j!_!`2n!`;'S%j;'S;=`%{<%lO%jj6ZWyW#SQOy%jz!O%j!O!P6s!P!Q%j!Q![9x![;'S%j;'S;=`%{<%lO%jj6xU!r`Oy%jz!Q%j!Q![7[![;'S%j;'S;=`%{<%lO%jj7cY!r`$jYOy%jz!Q%j!Q![7[![!g%j!g!h8R!h#X%j#X#Y8R#Y;'S%j;'S;=`%{<%lO%jj8WY!r`Oy%jz{%j{|8v|}%j}!O8v!O!Q%j!Q![9_![;'S%j;'S;=`%{<%lO%jj8{U!r`Oy%jz!Q%j!Q![9_![;'S%j;'S;=`%{<%lO%jj9fU!r`$jYOy%jz!Q%j!Q![9_![;'S%j;'S;=`%{<%lO%jj:P[!r`$jYOy%jz!O%j!O!P7[!P!Q%j!Q![9x![!g%j!g!h8R!h#X%j#X#Y8R#Y;'S%j;'S;=`%{<%lO%jj:zS!eYOy%jz;'S%j;'S;=`%{<%lO%jj;]WyWOy%jz!O%j!O!P6s!P!Q%j!Q![9x![;'S%j;'S;=`%{<%lO%jj;zU`YOy%jz!Q%j!Q![7[![;'S%j;'S;=`%{<%lO%j~<cTyWOy%jz{<r{;'S%j;'S;=`%{<%lO%j~<yS!r`$`~Oy%jz;'S%j;'S;=`%{<%lO%jj=[[$jYOy%jz!O%j!O!P7[!P!Q%j!Q![9x![!g%j!g!h8R!h#X%j#X#Y8R#Y;'S%j;'S;=`%{<%lO%jj>VUcYOy%jz![%j![!]>i!];'S%j;'S;=`%{<%lO%jj>pSdY!r`Oy%jz;'S%j;'S;=`%{<%lO%jj?RSnYOy%jz;'S%j;'S;=`%{<%lO%jh?dU!WWOy%jz!_%j!_!`?v!`;'S%j;'S;=`%{<%lO%jh?}S!WW!r`Oy%jz;'S%j;'S;=`%{<%lO%jl@bS!WW!|SOy%jz;'S%j;'S;=`%{<%lO%jj@uV#PQ!WWOy%jz!_%j!_!`?v!`!aA[!a;'S%j;'S;=`%{<%lO%jbAcS#PQ!r`Oy%jz;'S%j;'S;=`%{<%lO%jjArYOy%jz}%j}!OBb!O!c%j!c!}CP!}#T%j#T#oCP#o;'S%j;'S;=`%{<%lO%jjBgW!r`Oy%jz!c%j!c!}CP!}#T%j#T#oCP#o;'S%j;'S;=`%{<%lO%jjCW[lY!r`Oy%jz}%j}!OCP!O!Q%j!Q![CP![!c%j!c!}CP!}#T%j#T#oCP#o;'S%j;'S;=`%{<%lO%jhDRS!}WOy%jz;'S%j;'S;=`%{<%lO%jjDdSpYOy%jz;'S%j;'S;=`%{<%lO%jnDuSo^Oy%jz;'S%j;'S;=`%{<%lO%jjEWU!}WOy%jz#a%j#a#bEj#b;'S%j;'S;=`%{<%lO%jbEoU!r`Oy%jz#d%j#d#eFR#e;'S%j;'S;=`%{<%lO%jbFWU!r`Oy%jz#c%j#c#dFj#d;'S%j;'S;=`%{<%lO%jbFoU!r`Oy%jz#f%j#f#gGR#g;'S%j;'S;=`%{<%lO%jbGWU!r`Oy%jz#h%j#h#iGj#i;'S%j;'S;=`%{<%lO%jbGoU!r`Oy%jz#T%j#T#UHR#U;'S%j;'S;=`%{<%lO%jbHWU!r`Oy%jz#b%j#b#cHj#c;'S%j;'S;=`%{<%lO%jbHoU!r`Oy%jz#h%j#h#iIR#i;'S%j;'S;=`%{<%lO%jbIYS$rQ!r`Oy%jz;'S%j;'S;=`%{<%lO%jjIkSsYOy%jz;'S%j;'S;=`%{<%lO%jfI|U$fUOy%jz!_%j!_!`2n!`;'S%j;'S;=`%{<%lO%jjJeSrYOy%jz;'S%j;'S;=`%{<%lO%jfJvU#SQOy%jz!_%j!_!`2n!`;'S%j;'S;=`%{<%lO%j`K]P;=`<%l%Z",
	tokenizers: [
		descendant,
		unitToken,
		identifiers,
		queryIdentifiers,
		1,
		2,
		3,
		4,
		new LocalTokenGroup("m~RRYZ[z{a~~g~aO$b~~dP!P!Qg~lO$c~~", 28, 155)
	],
	topRules: {
		"StyleSheet": [0, 6],
		"Styles": [1, 129]
	},
	dynamicPrecedences: { "97": 1 },
	specialized: [
		{
			term: 150,
			get: (value) => spec_callee[value] || -1
		},
		{
			term: 151,
			get: (value) => spec_queryIdentifier[value] || -1
		},
		{
			term: 4,
			get: (value) => spec_QueryCallee[value] || -1
		},
		{
			term: 28,
			get: (value) => spec_AtKeyword[value] || -1
		},
		{
			term: 149,
			get: (value) => spec_identifier[value] || -1
		}
	],
	tokenPrec: 2444
});
//#endregion
//#region node_modules/@codemirror/lang-css/dist/index.js
var _properties = null;
function properties() {
	if (!_properties && typeof document == "object" && document.body) {
		let { style } = document.body, names = [], seen = /* @__PURE__ */ new Set();
		for (let prop in style) if (prop != "cssText" && prop != "cssFloat") {
			if (typeof style[prop] == "string") {
				if (/[A-Z]/.test(prop)) prop = prop.replace(/[A-Z]/g, (ch) => "-" + ch.toLowerCase());
				if (!seen.has(prop)) {
					names.push(prop);
					seen.add(prop);
				}
			}
		}
		_properties = names.sort().map((name) => ({
			type: "property",
			label: name,
			apply: name + ": "
		}));
	}
	return _properties || [];
}
var pseudoClasses = /*@__PURE__*/ [
	"active",
	"after",
	"any-link",
	"autofill",
	"backdrop",
	"before",
	"checked",
	"cue",
	"default",
	"defined",
	"disabled",
	"empty",
	"enabled",
	"file-selector-button",
	"first",
	"first-child",
	"first-letter",
	"first-line",
	"first-of-type",
	"focus",
	"focus-visible",
	"focus-within",
	"fullscreen",
	"has",
	"host",
	"host-context",
	"hover",
	"in-range",
	"indeterminate",
	"invalid",
	"is",
	"lang",
	"last-child",
	"last-of-type",
	"left",
	"link",
	"marker",
	"modal",
	"not",
	"nth-child",
	"nth-last-child",
	"nth-last-of-type",
	"nth-of-type",
	"only-child",
	"only-of-type",
	"optional",
	"out-of-range",
	"part",
	"placeholder",
	"placeholder-shown",
	"read-only",
	"read-write",
	"required",
	"right",
	"root",
	"scope",
	"selection",
	"slotted",
	"target",
	"target-text",
	"valid",
	"visited",
	"where"
].map((name) => ({
	type: "class",
	label: name
}));
var values = /*@__PURE__*/ [
	"above",
	"absolute",
	"activeborder",
	"additive",
	"activecaption",
	"after-white-space",
	"ahead",
	"alias",
	"all",
	"all-scroll",
	"alphabetic",
	"alternate",
	"always",
	"antialiased",
	"appworkspace",
	"asterisks",
	"attr",
	"auto",
	"auto-flow",
	"avoid",
	"avoid-column",
	"avoid-page",
	"avoid-region",
	"axis-pan",
	"background",
	"backwards",
	"baseline",
	"below",
	"bidi-override",
	"blink",
	"block",
	"block-axis",
	"bold",
	"bolder",
	"border",
	"border-box",
	"both",
	"bottom",
	"break",
	"break-all",
	"break-word",
	"bullets",
	"button",
	"button-bevel",
	"buttonface",
	"buttonhighlight",
	"buttonshadow",
	"buttontext",
	"calc",
	"capitalize",
	"caps-lock-indicator",
	"caption",
	"captiontext",
	"caret",
	"cell",
	"center",
	"checkbox",
	"circle",
	"cjk-decimal",
	"clear",
	"clip",
	"close-quote",
	"col-resize",
	"collapse",
	"color",
	"color-burn",
	"color-dodge",
	"column",
	"column-reverse",
	"compact",
	"condensed",
	"contain",
	"content",
	"contents",
	"content-box",
	"context-menu",
	"continuous",
	"copy",
	"counter",
	"counters",
	"cover",
	"crop",
	"cross",
	"crosshair",
	"currentcolor",
	"cursive",
	"cyclic",
	"darken",
	"dashed",
	"decimal",
	"decimal-leading-zero",
	"default",
	"default-button",
	"dense",
	"destination-atop",
	"destination-in",
	"destination-out",
	"destination-over",
	"difference",
	"disc",
	"discard",
	"disclosure-closed",
	"disclosure-open",
	"document",
	"dot-dash",
	"dot-dot-dash",
	"dotted",
	"double",
	"down",
	"e-resize",
	"ease",
	"ease-in",
	"ease-in-out",
	"ease-out",
	"element",
	"ellipse",
	"ellipsis",
	"embed",
	"end",
	"ethiopic-abegede-gez",
	"ethiopic-halehame-aa-er",
	"ethiopic-halehame-gez",
	"ew-resize",
	"exclusion",
	"expanded",
	"extends",
	"extra-condensed",
	"extra-expanded",
	"fantasy",
	"fast",
	"fill",
	"fill-box",
	"fixed",
	"flat",
	"flex",
	"flex-end",
	"flex-start",
	"footnotes",
	"forwards",
	"from",
	"geometricPrecision",
	"graytext",
	"grid",
	"groove",
	"hand",
	"hard-light",
	"help",
	"hidden",
	"hide",
	"higher",
	"highlight",
	"highlighttext",
	"horizontal",
	"hsl",
	"hsla",
	"hue",
	"icon",
	"ignore",
	"inactiveborder",
	"inactivecaption",
	"inactivecaptiontext",
	"infinite",
	"infobackground",
	"infotext",
	"inherit",
	"initial",
	"inline",
	"inline-axis",
	"inline-block",
	"inline-flex",
	"inline-grid",
	"inline-table",
	"inset",
	"inside",
	"intrinsic",
	"invert",
	"italic",
	"justify",
	"keep-all",
	"landscape",
	"large",
	"larger",
	"left",
	"level",
	"lighter",
	"lighten",
	"line-through",
	"linear",
	"linear-gradient",
	"lines",
	"list-item",
	"listbox",
	"listitem",
	"local",
	"logical",
	"loud",
	"lower",
	"lower-hexadecimal",
	"lower-latin",
	"lower-norwegian",
	"lowercase",
	"ltr",
	"luminosity",
	"manipulation",
	"match",
	"matrix",
	"matrix3d",
	"medium",
	"menu",
	"menutext",
	"message-box",
	"middle",
	"min-intrinsic",
	"mix",
	"monospace",
	"move",
	"multiple",
	"multiple_mask_images",
	"multiply",
	"n-resize",
	"narrower",
	"ne-resize",
	"nesw-resize",
	"no-close-quote",
	"no-drop",
	"no-open-quote",
	"no-repeat",
	"none",
	"normal",
	"not-allowed",
	"nowrap",
	"ns-resize",
	"numbers",
	"numeric",
	"nw-resize",
	"nwse-resize",
	"oblique",
	"opacity",
	"open-quote",
	"optimizeLegibility",
	"optimizeSpeed",
	"outset",
	"outside",
	"outside-shape",
	"overlay",
	"overline",
	"padding",
	"padding-box",
	"painted",
	"page",
	"paused",
	"perspective",
	"pinch-zoom",
	"plus-darker",
	"plus-lighter",
	"pointer",
	"polygon",
	"portrait",
	"pre",
	"pre-line",
	"pre-wrap",
	"preserve-3d",
	"progress",
	"push-button",
	"radial-gradient",
	"radio",
	"read-only",
	"read-write",
	"read-write-plaintext-only",
	"rectangle",
	"region",
	"relative",
	"repeat",
	"repeating-linear-gradient",
	"repeating-radial-gradient",
	"repeat-x",
	"repeat-y",
	"reset",
	"reverse",
	"rgb",
	"rgba",
	"ridge",
	"right",
	"rotate",
	"rotate3d",
	"rotateX",
	"rotateY",
	"rotateZ",
	"round",
	"row",
	"row-resize",
	"row-reverse",
	"rtl",
	"run-in",
	"running",
	"s-resize",
	"sans-serif",
	"saturation",
	"scale",
	"scale3d",
	"scaleX",
	"scaleY",
	"scaleZ",
	"screen",
	"scroll",
	"scrollbar",
	"scroll-position",
	"se-resize",
	"self-start",
	"self-end",
	"semi-condensed",
	"semi-expanded",
	"separate",
	"serif",
	"show",
	"single",
	"skew",
	"skewX",
	"skewY",
	"skip-white-space",
	"slide",
	"slider-horizontal",
	"slider-vertical",
	"sliderthumb-horizontal",
	"sliderthumb-vertical",
	"slow",
	"small",
	"small-caps",
	"small-caption",
	"smaller",
	"soft-light",
	"solid",
	"source-atop",
	"source-in",
	"source-out",
	"source-over",
	"space",
	"space-around",
	"space-between",
	"space-evenly",
	"spell-out",
	"square",
	"start",
	"static",
	"status-bar",
	"stretch",
	"stroke",
	"stroke-box",
	"sub",
	"subpixel-antialiased",
	"svg_masks",
	"super",
	"sw-resize",
	"symbolic",
	"symbols",
	"system-ui",
	"table",
	"table-caption",
	"table-cell",
	"table-column",
	"table-column-group",
	"table-footer-group",
	"table-header-group",
	"table-row",
	"table-row-group",
	"text",
	"text-bottom",
	"text-top",
	"textarea",
	"textfield",
	"thick",
	"thin",
	"threeddarkshadow",
	"threedface",
	"threedhighlight",
	"threedlightshadow",
	"threedshadow",
	"to",
	"top",
	"transform",
	"translate",
	"translate3d",
	"translateX",
	"translateY",
	"translateZ",
	"transparent",
	"ultra-condensed",
	"ultra-expanded",
	"underline",
	"unidirectional-pan",
	"unset",
	"up",
	"upper-latin",
	"uppercase",
	"url",
	"var",
	"vertical",
	"vertical-text",
	"view-box",
	"visible",
	"visibleFill",
	"visiblePainted",
	"visibleStroke",
	"visual",
	"w-resize",
	"wait",
	"wave",
	"wider",
	"window",
	"windowframe",
	"windowtext",
	"words",
	"wrap",
	"wrap-reverse",
	"x-large",
	"x-small",
	"xor",
	"xx-large",
	"xx-small"
].map((name) => ({
	type: "keyword",
	label: name
})).concat(/*@__PURE__*/ [
	"aliceblue",
	"antiquewhite",
	"aqua",
	"aquamarine",
	"azure",
	"beige",
	"bisque",
	"black",
	"blanchedalmond",
	"blue",
	"blueviolet",
	"brown",
	"burlywood",
	"cadetblue",
	"chartreuse",
	"chocolate",
	"coral",
	"cornflowerblue",
	"cornsilk",
	"crimson",
	"cyan",
	"darkblue",
	"darkcyan",
	"darkgoldenrod",
	"darkgray",
	"darkgreen",
	"darkkhaki",
	"darkmagenta",
	"darkolivegreen",
	"darkorange",
	"darkorchid",
	"darkred",
	"darksalmon",
	"darkseagreen",
	"darkslateblue",
	"darkslategray",
	"darkturquoise",
	"darkviolet",
	"deeppink",
	"deepskyblue",
	"dimgray",
	"dodgerblue",
	"firebrick",
	"floralwhite",
	"forestgreen",
	"fuchsia",
	"gainsboro",
	"ghostwhite",
	"gold",
	"goldenrod",
	"gray",
	"grey",
	"green",
	"greenyellow",
	"honeydew",
	"hotpink",
	"indianred",
	"indigo",
	"ivory",
	"khaki",
	"lavender",
	"lavenderblush",
	"lawngreen",
	"lemonchiffon",
	"lightblue",
	"lightcoral",
	"lightcyan",
	"lightgoldenrodyellow",
	"lightgray",
	"lightgreen",
	"lightpink",
	"lightsalmon",
	"lightseagreen",
	"lightskyblue",
	"lightslategray",
	"lightsteelblue",
	"lightyellow",
	"lime",
	"limegreen",
	"linen",
	"magenta",
	"maroon",
	"mediumaquamarine",
	"mediumblue",
	"mediumorchid",
	"mediumpurple",
	"mediumseagreen",
	"mediumslateblue",
	"mediumspringgreen",
	"mediumturquoise",
	"mediumvioletred",
	"midnightblue",
	"mintcream",
	"mistyrose",
	"moccasin",
	"navajowhite",
	"navy",
	"oldlace",
	"olive",
	"olivedrab",
	"orange",
	"orangered",
	"orchid",
	"palegoldenrod",
	"palegreen",
	"paleturquoise",
	"palevioletred",
	"papayawhip",
	"peachpuff",
	"peru",
	"pink",
	"plum",
	"powderblue",
	"purple",
	"rebeccapurple",
	"red",
	"rosybrown",
	"royalblue",
	"saddlebrown",
	"salmon",
	"sandybrown",
	"seagreen",
	"seashell",
	"sienna",
	"silver",
	"skyblue",
	"slateblue",
	"slategray",
	"snow",
	"springgreen",
	"steelblue",
	"tan",
	"teal",
	"thistle",
	"tomato",
	"turquoise",
	"violet",
	"wheat",
	"white",
	"whitesmoke",
	"yellow",
	"yellowgreen"
].map((name) => ({
	type: "constant",
	label: name
})));
var tags = /*@__PURE__*/ [
	"a",
	"abbr",
	"address",
	"article",
	"aside",
	"b",
	"bdi",
	"bdo",
	"blockquote",
	"body",
	"br",
	"button",
	"canvas",
	"caption",
	"cite",
	"code",
	"col",
	"colgroup",
	"dd",
	"del",
	"details",
	"dfn",
	"dialog",
	"div",
	"dl",
	"dt",
	"em",
	"figcaption",
	"figure",
	"footer",
	"form",
	"header",
	"hgroup",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"html",
	"i",
	"iframe",
	"img",
	"input",
	"ins",
	"kbd",
	"label",
	"legend",
	"li",
	"main",
	"meter",
	"nav",
	"ol",
	"output",
	"p",
	"pre",
	"ruby",
	"section",
	"select",
	"small",
	"source",
	"span",
	"strong",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"template",
	"textarea",
	"tfoot",
	"th",
	"thead",
	"tr",
	"u",
	"ul"
].map((name) => ({
	type: "type",
	label: name
}));
var atRules = /*@__PURE__*/ [
	"@charset",
	"@color-profile",
	"@container",
	"@counter-style",
	"@font-face",
	"@font-feature-values",
	"@font-palette-values",
	"@import",
	"@keyframes",
	"@layer",
	"@media",
	"@namespace",
	"@page",
	"@position-try",
	"@property",
	"@scope",
	"@starting-style",
	"@supports",
	"@view-transition"
].map((label) => ({
	type: "keyword",
	label
}));
var identifier = /^(\w[\w-]*|-\w[\w-]*|)$/;
var variable = /^-(-[\w-]*)?$/;
function isVarArg(node, doc) {
	var _a;
	if (node.name == "(" || node.type.isError) node = node.parent || node;
	if (node.name != "ArgList") return false;
	let callee = (_a = node.parent) === null || _a === void 0 ? void 0 : _a.firstChild;
	if ((callee === null || callee === void 0 ? void 0 : callee.name) != "Callee") return false;
	return doc.sliceString(callee.from, callee.to) == "var";
}
var VariablesByNode = /*@__PURE__*/ new NodeWeakMap();
var declSelector = ["Declaration"];
function astTop(node) {
	for (let cur = node;;) {
		if (cur.type.isTop) return cur;
		if (!(cur = cur.parent)) return node;
	}
}
function variableNames(doc, node, isVariable) {
	if (node.to - node.from > 4096) {
		let known = VariablesByNode.get(node);
		if (known) return known;
		let result = [], seen = /* @__PURE__ */ new Set(), cursor = node.cursor(IterMode.IncludeAnonymous);
		if (cursor.firstChild()) do
			for (let option of variableNames(doc, cursor.node, isVariable)) if (!seen.has(option.label)) {
				seen.add(option.label);
				result.push(option);
			}
		while (cursor.nextSibling());
		VariablesByNode.set(node, result);
		return result;
	} else {
		let result = [], seen = /* @__PURE__ */ new Set();
		node.cursor().iterate((node) => {
			var _a;
			if (isVariable(node) && node.matchContext(declSelector) && ((_a = node.node.nextSibling) === null || _a === void 0 ? void 0 : _a.name) == ":") {
				let name = doc.sliceString(node.from, node.to);
				if (!seen.has(name)) {
					seen.add(name);
					result.push({
						label: name,
						type: "variable"
					});
				}
			}
		});
		return result;
	}
}
/**
Create a completion source for a CSS dialect, providing a
predicate for determining what kind of syntax node can act as a
completable variable. This is used by language modes like Sass and
Less to reuse this package's completion logic.
*/
var defineCSSCompletionSource = (isVariable) => (context) => {
	let { state, pos } = context, node = syntaxTree(state).resolveInner(pos, -1);
	let isDash = node.type.isError && node.from == node.to - 1 && state.doc.sliceString(node.from, node.to) == "-";
	if (node.name == "PropertyName" || (isDash || node.name == "TagName") && /^(Block|Styles)$/.test(node.resolve(node.to).name)) return {
		from: node.from,
		options: properties(),
		validFor: identifier
	};
	if (node.name == "ValueName") return {
		from: node.from,
		options: values,
		validFor: identifier
	};
	if (node.name == "PseudoClassName") return {
		from: node.from,
		options: pseudoClasses,
		validFor: identifier
	};
	if (isVariable(node) || (context.explicit || isDash) && isVarArg(node, state.doc)) return {
		from: isVariable(node) || isDash ? node.from : pos,
		options: variableNames(state.doc, astTop(node), isVariable),
		validFor: variable
	};
	if (node.name == "TagName") {
		for (let { parent } = node; parent; parent = parent.parent) if (parent.name == "Block") return {
			from: node.from,
			options: properties(),
			validFor: identifier
		};
		return {
			from: node.from,
			options: tags,
			validFor: identifier
		};
	}
	if (node.name == "AtKeyword") return {
		from: node.from,
		options: atRules,
		validFor: identifier
	};
	if (!context.explicit) return null;
	let above = node.resolve(pos), before = above.childBefore(pos);
	if (before && before.name == ":" && above.name == "PseudoClassSelector") return {
		from: pos,
		options: pseudoClasses,
		validFor: identifier
	};
	if (before && before.name == ":" && above.name == "Declaration" || above.name == "ArgList") return {
		from: pos,
		options: values,
		validFor: identifier
	};
	if (above.name == "Block" || above.name == "Styles") return {
		from: pos,
		options: properties(),
		validFor: identifier
	};
	return null;
};
/**
CSS property, variable, and value keyword completion source.
*/
var cssCompletionSource = /*@__PURE__*/ defineCSSCompletionSource((n) => n.name == "VariableName");
/**
A language provider based on the [Lezer CSS
parser](https://github.com/lezer-parser/css), extended with
highlighting and indentation information.
*/
var cssLanguage = /*@__PURE__*/ LRLanguage.define({
	name: "css",
	parser: /*@__PURE__*/ parser.configure({ props: [/*@__PURE__*/ indentNodeProp.add({ Declaration: /*@__PURE__*/ continuedIndent() }), /*@__PURE__*/ foldNodeProp.add({ "Block KeyframeList": foldInside })] }),
	languageData: {
		commentTokens: { block: {
			open: "/*",
			close: "*/"
		} },
		indentOnInput: /^\s*\}$/,
		wordChars: "-"
	}
});
/**
Language support for CSS.
*/
function css() {
	return new LanguageSupport(cssLanguage, cssLanguage.data.of({ autocomplete: cssCompletionSource }));
}
//#endregion
export { LRParser as a, ExternalTokenizer as i, cssLanguage as n, LocalTokenGroup as o, ContextTracker as r, css as t };
