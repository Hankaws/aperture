/**
 * Type errors a parse will not catch.
 *
 * Not a full `tsc`. It reports only mistakes it can prove from the text: an
 * annotation that rejects its literal, a returned literal of the wrong type, a
 * call with the wrong number of arguments, and a name that is not in scope.
 * Anything ambiguous is left alone. A green Types row means these checks ran
 * and found nothing, not that the TypeScript compiler was invoked.
 */
import type { SyntaxNode } from "@lezer/common";
import { jsParserFor } from "../parser/lezer.ts";
import { isScriptPath } from "./syntax-check.ts";

const MAX_PARSE_CHARS = 400_000;
const MAX_ISSUES = 4;
const TS_EXT = /\.(m|c)?tsx?$/i;

const GLOBALS = new Set([
  "Array", "ArrayBuffer", "Atomics", "BigInt", "Blob", "Boolean", "DataView", "Date", "Error",
  "EvalError", "Float32Array", "Float64Array", "FormData", "Function", "Headers", "Infinity",
  "Int8Array", "Int16Array", "Int32Array", "Intl", "JSON", "Map", "Math", "NaN", "Number",
  "Object", "Promise", "Proxy", "RangeError", "ReferenceError", "Reflect", "RegExp", "Request",
  "Response", "Set", "String", "Symbol", "SyntaxError", "TextDecoder", "TextEncoder", "TypeError",
  "URIError", "URL", "URLSearchParams", "Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array",
  "WeakMap", "WeakSet", "AbortController", "AbortSignal", "Buffer", "CustomEvent", "Event",
  "HTMLElement", "Node", "atob", "btoa", "clearInterval", "clearTimeout", "console", "crypto",
  "decodeURI", "decodeURIComponent", "document", "encodeURI", "encodeURIComponent", "escape",
  "fetch", "global", "globalThis", "history", "isFinite", "isNaN", "localStorage", "location",
  "navigator", "parseFloat", "parseInt", "performance", "process", "queueMicrotask",
  "requestAnimationFrame", "self", "sessionStorage", "setInterval", "setTimeout", "structuredClone",
  "undefined", "unescape", "window", "ResizeObserver", "IntersectionObserver",
  "MutationObserver", "Element", "Document", "DocumentFragment", "SVGElement", "EventTarget",
  "MessageEvent", "Worker", "WebSocket", "Notification", "DOMParser", "XMLHttpRequest", "Image",
  "FileReader", "ReadableStream", "WritableStream", "TransformStream", "MessageChannel", "MessagePort",
  "cancelAnimationFrame", "DOMException", "RTCPeerConnection", "RTCSessionDescription", "RTCIceCandidate",
  "PopStateEvent",
]);

type Sig = { required: number; total: number; rest: boolean };

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function lineAt(starts: number[], pos: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function kids(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) out.push(child);
  return out;
}

function treeHasError(tree: { iterate: (spec: { enter: (node: { type: { isError: boolean } }) => void }) => void }): boolean {
  let bad = false;
  tree.iterate({
    enter(node) {
      if (node.type.isError) bad = true;
    },
  });
  return bad;
}

/** Only primitives. `AgentPhase` and `string | null` are not something this checker can judge. */
function checkableType(annotation: string): string | null {
  const simple = simpleType(annotation);
  if (!simple || !/^(string|number|boolean|null|undefined)(\[\])?$/.test(simple)) return null;
  return simple;
}

/** `string`, `number[]`, `Array<string>`. Unions and object types are not simple. */
function simpleType(annotation: string): string | null {
  const text = annotation.trim().replace(/^readonly\s+/, "");
  if (!text || /[|&{}()]/.test(text) || text === "any" || text === "unknown" || text === "object") return null;
  const array = text.match(/^([A-Za-z_$][\w$]*)\[\]$/) ?? text.match(/^Array<([A-Za-z_$][\w$]*)>$/);
  if (array) return `${array[1]}[]`;
  if (/^[A-Za-z_$][\w$]*$/.test(text)) return text;
  return null;
}

function literalKind(node: SyntaxNode, text: string): string | null {
  if (node.name === "String") return "string";
  if (node.name === "TemplateString") {
    if (kids(node).some((child) => child.name === "Interpolation")) return null;
    return "string";
  }
  if (node.name === "Number") return "number";
  if (node.name === "BooleanLiteral") return "boolean";
  if (node.name === "null") return "null";
  if (node.name === "ParenthesizedExpression") {
    const inner = kids(node).find((child) => child.name !== "(" && child.name !== ")");
    return inner ? literalKind(inner, text) : null;
  }
  if (node.name === "UnaryExpression") {
    if (text.slice(node.from, node.to) === "undefined") return "undefined";
    const op = node.firstChild;
    const inner = op?.nextSibling ?? null;
    if (!op || !inner) return null;
    const opText = text.slice(op.from, op.to);
    if (op.name === "ArithOp" && (opText === "-" || opText === "+") && inner.name === "Number") return "number";
    if (op.name === "LogicOp" && opText === "!" && literalKind(inner, text)) return "boolean";
    return null;
  }
  if (node.name === "VariableName" && text.slice(node.from, node.to) === "undefined") return "undefined";
  if (node.name === "ArrayExpression") {
    const items = kids(node).filter((child) => child.name !== "[" && child.name !== "]" && child.name !== ",");
    if (items.length === 0) return null;
    const kinds = items.map((item) => literalKind(item, text));
    if (kinds.every((kind) => kind === "number")) return "number[]";
    if (kinds.every((kind) => kind === "string")) return "string[]";
    if (kinds.every((kind) => kind === "boolean")) return "boolean[]";
  }
  return null;
}

function annotationText(node: SyntaxNode, text: string): string | null {
  const ann = kids(node).find((child) => child.name === "TypeAnnotation");
  if (!ann) return null;
  return text.slice(ann.from, ann.to).replace(/^:\s*/, "");
}

function initializer(node: SyntaxNode): SyntaxNode | null {
  const list = kids(node);
  const eq = list.findIndex((child) => child.name === "Equals");
  if (eq < 0) return null;
  return list[eq + 1] ?? null;
}

function paramsOf(list: SyntaxNode | null): Sig {
  const sig: Sig = { required: 0, total: 0, rest: false };
  if (!list) return sig;
  let restNext = false;
  let optional = false;
  const parts = kids(list);
  for (let i = 0; i < parts.length; i += 1) {
    const child = parts[i]!;
    if (child.name === "Spread") {
      restNext = true;
      continue;
    }
    if (child.name !== "VariableDefinition") continue;
    if (restNext) {
      sig.rest = true;
      restNext = false;
      continue;
    }
    let isOptional = kids(child).some((part) => part.name === "Optional" || part.name === "Equals");
    for (let j = i + 1; j < parts.length; j += 1) {
      const next = parts[j]!;
      if (next.name === "," || next.name === "VariableDefinition" || next.name === ")") break;
      if (next.name === "Optional" || next.name === "Equals") isOptional = true;
    }
    sig.total += 1;
    if (isOptional) optional = true;
    else if (!optional) sig.required += 1;
    else optional = true;
  }
  return sig;
}

function addSig(map: Map<string, Sig | "many">, name: string, sig: Sig) {
  const prev = map.get(name);
  if (!prev) map.set(name, sig);
  else if (prev === "many" || prev.required !== sig.required || prev.total !== sig.total || prev.rest !== sig.rest) {
    map.set(name, "many");
  }
}

function collectSignatures(files: Record<string, string>): Map<string, Sig | "many"> {
  const map = new Map<string, Sig | "many">();
  const paths = Object.keys(files)
    .filter((path) => isScriptPath(path) && !/(^|\/)(node_modules|dist|\.git)\//.test(path))
    .slice(0, 200);
  for (const path of paths) {
    const text = files[path] ?? "";
    if (!text.trim() || text.length > MAX_PARSE_CHARS) continue;
    let tree;
    try {
      tree = jsParserFor(path).parse(text);
    } catch {
      continue;
    }
    if (treeHasError(tree)) continue;
    tree.iterate({
      enter(node) {
        if (node.name === "FunctionDeclaration") {
          const name = kids(node.node).find((child) => child.name === "VariableDefinition");
          const list = kids(node.node).find((child) => child.name === "ParamList");
          if (name) addSig(map, text.slice(name.from, name.to), paramsOf(list ?? null));
        }
        if (node.name === "VariableDeclaration") {
          const name = kids(node.node).find((child) => child.name === "VariableDefinition");
          const init = initializer(node.node);
          const fn = init && (init.name === "ArrowFunction" || init.name === "FunctionExpression") ? init : null;
          const list = fn ? kids(fn).find((child) => child.name === "ParamList") : null;
        if (name && fn && !annotationText(node.node, text)) {
          addSig(map, text.slice(name.from, name.to), paramsOf(list ?? null));
        }
        }
      },
    });
  }
  return map;
}

function bindingsIn(root: SyntaxNode, text: string): Set<string> {
  const names = new Set<string>();
  const walk = (node: SyntaxNode) => {
    if (node.name === "VariableDefinition" || node.name === "TypeDefinition") {
      names.add(text.slice(node.from, node.to));
    }
    if (node.name === "PatternProperty") {
      const parts = kids(node);
      if (!parts.some((part) => part.name === "VariableDefinition")) {
        const prop = parts.find((part) => part.name === "PropertyName");
        if (prop) names.add(text.slice(prop.from, prop.to));
      }
    }
    for (const child of kids(node)) walk(child);
  };
  walk(root);
  return names;
}

/** The name after `as` in `export { local as Public }` is a new export name, not a reference. */
function insideExportAlias(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (!parent || parent.name !== "ExportGroup") return false;
  return node.prevSibling?.name === "as";
}

function insideImport(node: SyntaxNode): boolean {
  let parent = node.parent;
  while (parent) {
    if (parent.name === "ImportDeclaration") return true;
    parent = parent.parent;
  }
  return false;
}

function insideType(node: SyntaxNode): boolean {
  let parent = node.parent;
  while (parent) {
    if (
      parent.name === "TypeAnnotation" ||
      parent.name === "TypeAliasDeclaration" ||
      parent.name === "InterfaceDeclaration" ||
      parent.name === "TypeParameters"
    ) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

function argCount(list: SyntaxNode): number | null {
  let count = 0;
  for (const child of kids(list)) {
    if (child.name === "(" || child.name === ")" || child.name === ",") continue;
    if (child.name === "Spread") return null;
    count += 1;
  }
  return count;
}

function pushIssue(issues: string[], starts: number[], at: number, detail: string) {
  const line = `type error at line ${lineAt(starts, at)}: ${detail}`;
  if (!issues.includes(line)) issues.push(line);
}

export function isTypePath(path: string): boolean {
  return TS_EXT.test(path);
}

/** Definite type errors in one TypeScript file, against the staged project. */
export function typeIssues(path: string, input: string, files: Record<string, string>): string[] {
  const text = files[path] ?? input;
  if (!isTypePath(path) || !text.trim() || text.length > MAX_PARSE_CHARS) return [];
  let parsed;
  try {
    parsed = jsParserFor(path).parse(text);
  } catch {
    return [];
  }
  const root = parsed.topNode;
  if (treeHasError(parsed)) return [];
  const starts = lineStarts(text);
  const issues: string[] = [];
  const bindings = bindingsIn(root, text);
  const sigs = collectSignatures({ [path]: text });

  parsed.iterate({
    enter(node) {
      if (issues.length >= MAX_ISSUES) return;
      if (node.name === "VariableDeclaration" || node.name === "PropertyDeclaration") {
        const ann = annotationText(node.node, text);
        const init = initializer(node.node);
        if (!ann || !init || init.name === "BinaryExpression") return;
        const expected = checkableType(ann);
        const got = literalKind(init, text);
        if (expected && got && expected !== got) {
          pushIssue(issues, starts, node.from, `${got} is not assignable to ${expected}`);
        }
        return;
      }
      if (node.name === "FunctionDeclaration" || node.name === "ArrowFunction" || node.name === "MethodDeclaration") {
        const ann = kids(node.node).find((child) => child.name === "TypeAnnotation");
        const expected = ann ? checkableType(text.slice(ann.from, ann.to).replace(/^:\s*/, "")) : null;
        if (!expected) return;
        const parts = kids(node.node);
        const arrowAt = parts.findIndex((child) => child.name === "Arrow");
        const expr = arrowAt >= 0 ? parts[arrowAt + 1] : null;
        if (expr && expr.name !== "Block") {
          const got = literalKind(expr, text);
          if (got && got !== expected) {
            pushIssue(issues, starts, expr.from, `returned ${got} is not assignable to ${expected}`);
          }
          return;
        }
        const body = parts.find((child) => child.name === "Block") ?? null;
        const returns: SyntaxNode[] = [];
        const walk = (current: SyntaxNode) => {
          for (const child of kids(current)) {
            if (child.name === "FunctionDeclaration" || child.name === "ArrowFunction" || child.name === "MethodDeclaration") {
              continue;
            }
            if (child.name === "ReturnStatement") returns.push(child);
            else walk(child);
          }
        };
        if (body) walk(body);
        for (const statement of returns) {
          const value = kids(statement).find((child) => child.name !== "return" && child.name !== ";");
          if (!value) continue;
          const got = literalKind(value, text);
          if (got && got !== expected) {
            pushIssue(issues, starts, statement.from, `returned ${got} is not assignable to ${expected}`);
          }
        }
        return;
      }
      if (node.name === "CallExpression") {
        const callee = node.node.firstChild;
        if (!callee || callee.name !== "VariableName") return;
        const name = text.slice(callee.from, callee.to);
        const sig = sigs.get(name);
        if (!sig || sig === "many") return;
        const list = kids(node.node).find((child) => child.name === "ArgList");
        if (!list) return;
        const count = argCount(list);
        if (count === null) return;
        if (count < sig.required || (!sig.rest && count > sig.total)) {
          const expect = sig.rest ? `at least ${sig.required}` : sig.required === sig.total ? String(sig.required) : `${sig.required} to ${sig.total}`;
          pushIssue(issues, starts, callee.from, `${name} expects ${expect} argument${sig.required === 1 && !sig.rest && sig.total === 1 ? "" : "s"}, got ${count}`);
        }
        return;
      }
      if (node.name === "VariableName" && !insideType(node.node) && !insideImport(node.node) && !insideExportAlias(node.node)) {
        const name = text.slice(node.from, node.to);
        if (bindings.has(name) || GLOBALS.has(name)) return;
        pushIssue(issues, starts, node.from, `cannot find name ${name}`);
        return;
      }
      if (node.name === "JSXIdentifier") {
        const parent = node.node.parent;
        if (parent?.name === "JSXAttribute") return;
        if (parent?.name === "JSXMemberExpression" && parent.firstChild !== node.node) return;
        const name = text.slice(node.from, node.to);
        if (!/^[A-Z]/.test(name) || bindings.has(name) || GLOBALS.has(name)) return;
        pushIssue(issues, starts, node.from, `cannot find name ${name}`);
      }
    },
  });
  return issues.slice(0, MAX_ISSUES);
}
