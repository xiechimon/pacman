// src/lib/remoteTools.ts
var RETRY_DELAYS_MS = [500, 2e3];
function isTimeout(err) {
  const name = err?.name;
  return name === "TimeoutError" || name === "AbortError";
}
async function request(serverUrl, path, token, body, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? TIMEOUTS_MS.remoteTool;
  const once = async () => {
    const res = await serverRequest(serverUrl, path, { token, body, timeoutMs, signal: opts.signal });
    const json = await res.json().catch(() => null);
    const reply = { ok: res.ok, status: res.status, body: json };
    const transient = json?.transient;
    const shouldRetryResponse = transient === true || transient === void 0 && res.status >= 500;
    if (opts.replaySafe && !res.ok && shouldRetryResponse) {
      throw Object.assign(
        httpError(res, typeof json?.error === "string" ? json.error : void 0),
        { reply }
      );
    }
    return reply;
  };
  if (!opts.replaySafe) return once();
  try {
    return await withRetry(
      once,
      (err) => !!err?.reply || isRetryableHttpError(err),
      `[tool] ${opts.label ?? path}`,
      RETRY_DELAYS_MS,
      opts.signal
    );
  } catch (err) {
    const reply = err?.reply;
    if (reply) return reply;
    throw err;
  }
}
function parseJsonReply(reply, label) {
  if (!reply.ok) throw new Error(typeof reply.body?.error === "string" ? reply.body.error : `${label} failed (HTTP ${reply.status})`);
  return JSON.parse(typeof reply.body?.text === "string" ? reply.body.text : "");
}
function text(s) {
  return { content: [{ type: "text", text: s }], details: {} };
}
function makeRemoteTools(serverUrl, token, step) {
  return (step.remoteTools ?? []).map((def) => ({
    name: def.name,
    label: def.label,
    description: def.description,
    parameters: def.parameters,
    async execute(_id, params, signal) {
      const startedAt = Date.now();
      try {
        const reply = await request(serverUrl, `/api/machine/tool/${step.stepId}`, token, { name: def.name, params }, {
          replaySafe: def.replaySafe,
          label: def.name,
          signal
        });
        if (!reply.ok) {
          console.warn(`[tool] ${def.name} rejected: HTTP ${reply.status} in ${Date.now() - startedAt}ms`);
          const msg = reply.body?.error;
          return text(typeof msg === "string" ? msg : `${def.name} failed (HTTP ${reply.status}).`);
        }
        return text(typeof reply.body?.text === "string" ? reply.body.text : "");
      } catch (err) {
        if (signal?.aborted) throw err;
        const elapsed = Date.now() - startedAt;
        const how = isTimeout(err) ? `timed out after ${elapsed}ms` : `failed after ${elapsed}ms: ${formatError(err)}`;
        console.warn(`[tool] ${def.name} transport failure: ${how}`);
        return text(
          `${def.name} returned no result: the call to the Todos server ${how}. This is a connection problem, not a rejection \u2014 this machine's own network or proxy is as likely at fault as the server. ` + (def.r