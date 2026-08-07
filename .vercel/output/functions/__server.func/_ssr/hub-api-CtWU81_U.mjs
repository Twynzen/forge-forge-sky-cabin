import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/hub-api-CtWU81_U.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
/**
* Server functions — Frontend boundary for the Hub.
* Hub is always loaded via dynamic import so Node-only code
* never enters the client bundle.
*/
async function hub() {
	const { getHub } = await import("./hub-OAmgNCE1.mjs");
	return getHub();
}
var listProvidersFn_createServerFn_handler = createServerRpc({
	id: "3e0f5a919f4463cf4d1583535c35325786dfc9dc4c4ddf96c8fba81ec0a618e7",
	name: "listProvidersFn",
	filename: "src/lib/api/hub-api.ts"
}, (opts) => listProvidersFn.__executeServer(opts));
var listProvidersFn = createServerFn({ method: "GET" }).handler(listProvidersFn_createServerFn_handler, async () => {
	return (await hub()).listProviders();
});
var listSessionsFn_createServerFn_handler = createServerRpc({
	id: "14e31574dd662efbb822104bb48565eb312a5799b70b385a825c7a236b3cdbb7",
	name: "listSessionsFn",
	filename: "src/lib/api/hub-api.ts"
}, (opts) => listSessionsFn.__executeServer(opts));
var listSessionsFn = createServerFn({ method: "GET" }).handler(listSessionsFn_createServerFn_handler, async () => {
	const h = await hub();
	await h.ensureDemoSession();
	return h.listSessions();
});
var getSessionFn_createServerFn_handler = createServerRpc({
	id: "98650673cb4c496645c9112d91fe69903fd1eb2dbce2d71f2fa1d9cbc35db515",
	name: "getSessionFn",
	filename: "src/lib/api/hub-api.ts"
}, (opts) => getSessionFn.__executeServer(opts));
var getSessionFn = createServerFn({ method: "GET" }).validator((data) => data).handler(getSessionFn_createServerFn_handler, async ({ data }) => {
	const snap = (await hub()).getSnapshot(data.sessionId);
	if (!snap) throw new Error("Session not found");
	return snap;
});
var createSessionFn_createServerFn_handler = createServerRpc({
	id: "2176660bad82bca0c7bdc9ce94b86ce5543e62e083e1eb87049faa322dc6bbe0",
	name: "createSessionFn",
	filename: "src/lib/api/hub-api.ts"
}, (opts) => createSessionFn.__executeServer(opts));
var createSessionFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSessionFn_createServerFn_handler, async ({ data }) => {
	return (await hub()).createSession({
		providerId: data.providerId || "grok-build",
		title: data.title,
		cwd: data.cwd,
		model: data.model,
		demo: data.demo !== false
	});
});
var sendPromptFn_createServerFn_handler = createServerRpc({
	id: "1c05c3563cfeaea968b7f4475cc3a9984c47acb168e8345fae60367ce3fd5693",
	name: "sendPromptFn",
	filename: "src/lib/api/hub-api.ts"
}, (opts) => sendPromptFn.__executeServer(opts));
var sendPromptFn = createServerFn({ method: "POST" }).validator((data) => data).handler(sendPromptFn_createServerFn_handler, async ({ data }) => {
	await (await hub()).sendPrompt(data);
	return { ok: true };
});
var resolvePermissionFn_createServerFn_handler = createServerRpc({
	id: "1791d18087afc435b851ab81bc387b55c266695f8c46aeb41182ddc0081fa300",
	name: "resolvePermissionFn",
	filename: "src/lib/api/hub-api.ts"
}, (opts) => resolvePermissionFn.__executeServer(opts));
var resolvePermissionFn = createServerFn({ method: "POST" }).validator((data) => data).handler(resolvePermissionFn_createServerFn_handler, async ({ data }) => {
	await (await hub()).resolvePermission(data);
	return { ok: true };
});
var cancelSessionFn_createServerFn_handler = createServerRpc({
	id: "8bdc05409505885c06bbec94cbba35f24b9f215a80088192063f9aebecddd1b6",
	name: "cancelSessionFn",
	filename: "src/lib/api/hub-api.ts"
}, (opts) => cancelSessionFn.__executeServer(opts));
var cancelSessionFn = createServerFn({ method: "POST" }).validator((data) => data).handler(cancelSessionFn_createServerFn_handler, async ({ data }) => {
	await (await hub()).cancelSession(data.sessionId);
	return { ok: true };
});
var closeSessionFn_createServerFn_handler = createServerRpc({
	id: "6ac12d337ce0ce9e484352b2e9983249c6769843652b99e37ef411582379e73c",
	name: "closeSessionFn",
	filename: "src/lib/api/hub-api.ts"
}, (opts) => closeSessionFn.__executeServer(opts));
var closeSessionFn = createServerFn({ method: "POST" }).validator((data) => data).handler(closeSessionFn_createServerFn_handler, async ({ data }) => {
	await (await hub()).closeSession(data.sessionId);
	return { ok: true };
});
var startPromptFn_createServerFn_handler = createServerRpc({
	id: "a2435fc84607c30c5e0ce622fb11b1bee05c764e7ea54cb2afabcf578c6867d1",
	name: "startPromptFn",
	filename: "src/lib/api/hub-api.ts"
}, (opts) => startPromptFn.__executeServer(opts));
var startPromptFn = createServerFn({ method: "POST" }).validator((data) => data).handler(startPromptFn_createServerFn_handler, async ({ data }) => {
	(await hub()).sendPrompt(data).catch((err) => {
		console.error("[hub] prompt error", err);
	});
	return {
		ok: true,
		started: true
	};
});
//#endregion
export { cancelSessionFn_createServerFn_handler, closeSessionFn_createServerFn_handler, createSessionFn_createServerFn_handler, getSessionFn_createServerFn_handler, listProvidersFn_createServerFn_handler, listSessionsFn_createServerFn_handler, resolvePermissionFn_createServerFn_handler, sendPromptFn_createServerFn_handler, startPromptFn_createServerFn_handler };
