import { r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware--02wTOzZ.mjs";
import { n as createSsrRpc } from "./api-B6IoZzRV.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-B8dbh4HJ.js
var listAgents = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("a430df19b5efe91a0f9600ce19408af2615612b26ad11b3b036ce38a1a25313d"));
var saveAgent = createServerFn({ method: "POST" }).validator((input) => input).middleware([authMiddleware]).handler(createSsrRpc("e6c3bf3bc595548ea8ace93cb611972e3b1a86c99ba1031fb682662ee2b6d328"));
var deleteAgent = createServerFn({ method: "POST" }).validator((id) => id).middleware([authMiddleware]).handler(createSsrRpc("929b5a97545f35697cc70309886683070923d23416598b9474e0888b7580102c"));
//#endregion
export { listAgents as n, saveAgent as r, deleteAgent as t };
