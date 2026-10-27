'use client'
import {
  en
} from "./chunk-CWMEMPDF.js";

// src/react/provider.tsx
import { useEffect as useEffect3, useMemo as useMemo4, useRef as useRef3, useState } from "react";

// ../core-sdk-js/src/clientTrust.ts
var webCrypto = {
  sha256: async (data) => new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(data))),
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length))
};
var encoder = new TextEncoder();
function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function htu(url) {
  let parsed;
  try {
    const target = new URL(url);
    parsed = typeof target.origin === "string" && typeof target.pathname === "string" ? `${target.origin}${target.pathname}` : null;
  } catch {
    parsed = null;
  }
  if (parsed) return parsed;
  const match = /^([a-z][a-z\d+.-]*:\/\/[^/?#]+)([^?#]*)/i.exec(url);
  if (!match) throw new TypeError(`Not an absolute URL: ${url}`);
  return `${match[1].toLowerCase()}${match[2] || "/"}`;
}
function jwkThumbprint(jwk, hash) {
  return hash.sha256(encoder.encode(`{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`));
}
async function createDPoPProof(key, method, url, extra = {}, hash = webCrypto) {
  const header = { typ: "dpop+jwt", alg: "ES256", jwk: key.publicJwk };
  const claims = {
    htm: method,
    htu: htu(url),
    iat: Math.floor(Date.now() / 1e3),
    jti: base64url(hash.randomBytes(16))
  };
  if (extra.nonce) claims.nonce = extra.nonce;
  if (extra.accessToken) claims.ath = base64url(await hash.sha256(encoder.encode(extra.accessToken)));
  const signingInput = `${base64url(encoder.encode(JSON.stringify(header)))}.${base64url(encoder.encode(JSON.stringify(claims)))}`;
  return `${signingInput}.${base64url(await key.sign(encoder.encode(signingInput)))}`;
}
var EXPIRY_MARGIN_MS = 6e4;
var MINT_COOLDOWN_MS = 6e4;
var ClientTrust = class {
  constructor(send, resolveUrl, keys, botCheck, attestation, hash = webCrypto) {
    this.send = send;
    this.resolveUrl = resolveUrl;
    this.keys = keys;
    this.botCheck = botCheck;
    this.attestation = attestation;
    this.hash = hash;
  }
  send;
  resolveUrl;
  keys;
  botCheck;
  attestation;
  hash;
  token = null;
  minting = null;
  nextMintAt = 0;
  // Null when the last mint failed before reaching k-ID (no device key, no bot check), or did not fail.
  failure = null;
  async headers(method, path) {
    const token = await this.current();
    if (!token) return {};
    try {
      const key = await this.keys.getKey();
      const proof = await createDPoPProof(
        key,
        method,
        this.resolveUrl(path),
        { accessToken: token.clientToken },
        this.hash
      );
      return { "Kid-Client": token.clientToken, DPoP: proof };
    } catch {
      return {};
    }
  }
  /** The token step's failure that leaves calls without a token, with a 429's `retryAfter` as the seconds left
   * before the next mint; null when there is none. */
  tokenFailure() {
    const failure = this.failure;
    if (failure?.status !== 429) return failure;
    return { ...failure, retryAfter: Math.max(1, Math.ceil((this.nextMintAt - Date.now()) / 1e3)) };
  }
  invalidate() {
    this.token = null;
  }
  async trustLevel() {
    return (await this.current())?.trustLevel ?? null;
  }
  async current() {
    if (this.token && Date.parse(this.token.expiresAt) - EXPIRY_MARGIN_MS > Date.now()) return this.token;
    if (Date.now() < this.nextMintAt) return null;
    this.minting ??= this.mint().then((token) => {
      const retryAfter = this.failure?.retryAfter;
      if (!token) this.nextMintAt = Date.now() + (retryAfter !== void 0 ? retryAfter * 1e3 : MINT_COOLDOWN_MS);
      return token;
    }).finally(() => {
      this.minting = null;
    });
    this.token = await this.minting;
    return this.token;
  }
  async mint() {
    this.failure = null;
    try {
      const key = await this.keys.getKey();
      const challenge = await this.send("/client/challenge", { method: "POST", headers: {} });
      if (!challenge.ok) {
        this.failure = challenge;
        return null;
      }
      const nonce = challenge.data.nonce;
      if (typeof nonce !== "string") return null;
      const platform = this.attestation?.platform ?? "web";
      const evidence = this.attestation?.evidence;
      const body = (evidence && await evidence(
        await this.hash.sha256(
          encoder.encode(`${nonce}.${base64url(await jwkThumbprint(key.publicJwk, this.hash))}`)
        )
      )) ?? { platform };
      const hint = challenge.data.botCheck;
      if (hint && platform === "web") {
        if (!this.botCheck) return null;
        body.botCheckToken = await this.botCheck.token(hint);
      }
      const proof = await createDPoPProof(key, "POST", this.resolveUrl("/client/attest"), { nonce }, this.hash);
      const attest = await this.send("/client/attest", { method: "POST", headers: { DPoP: proof }, body });
      if (!attest.ok) {
        this.failure = attest;
        return null;
      }
      const token = attest.data;
      this.attestation?.minted?.(body, token.trustLevel === "verified");
      return token;
    } catch {
      return null;
    }
  }
};

// ../core-sdk-js/src/declareIcon.ts
var LOCAL_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.test|\[.*\]|\d+\.\d+\.\d+\.\d+)$/i;
function toBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(bin);
}
async function declaredIconUrl(iconUrl, fetchImpl, base) {
  if (iconUrl.startsWith("data:") || iconUrl.trim() === "") return iconUrl;
  let url;
  try {
    url = new URL(iconUrl, base);
  } catch {
    return iconUrl;
  }
  if (url.protocol === "https:" && !LOCAL_HOST.test(url.hostname)) return url.href;
  const res = await fetchImpl(url.href);
  if (!res.ok) throw new Error(`Could not read the app icon at ${url.href} (${res.status}).`);
  const blob = await res.blob();
  return `data:${blob.type || "application/octet-stream"};base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`;
}

// ../core-sdk-js/src/sse.ts
function createSseParser(onEvent) {
  let buffer = "";
  let event = "";
  let data = [];
  let retryMs;
  function line(text) {
    if (text === "") {
      if (data.length > 0) onEvent({ event: event || "message", data: data.join("\n") });
      event = "";
      data = [];
      return;
    }
    if (text.startsWith(":")) return;
    const colon = text.indexOf(":");
    const field = colon < 0 ? text : text.slice(0, colon);
    let value = colon < 0 ? "" : text.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    else if (field === "retry" && /^\d+$/.test(value)) retryMs = Number(value);
  }
  return {
    push(chunk) {
      buffer += chunk;
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const c = buffer[i];
        if (c !== "\n" && c !== "\r") continue;
        if (c === "\r" && i === buffer.length - 1) break;
        line(buffer.slice(start, i));
        if (c === "\r" && buffer[i + 1] === "\n") i++;
        start = i + 1;
      }
      buffer = buffer.slice(start);
    },
    get retryMs() {
      return retryMs;
    }
  };
}

// ../core-sdk-js/src/client.ts
var RAW_ERROR_TO_CODE = {
  NOT_FOUND: "not_found",
  UNAUTHORIZED: "unauthorized",
  TOO_MANY_REQUESTS: "rate_limited",
  INVALID_INPUT: "invalid_request",
  INVALID_EMAIL: "invalid_request",
  AGE_CONFLICT: "invalid_request",
  CLIENT_TOKEN_INVALID: "unauthorized",
  FEATURE_DISABLED: "unavailable",
  CANNOT_RESOLVE_JURISDICTION: "unavailable",
  INTERNAL_ERROR: "unavailable",
  UNKNOWN: "unavailable"
};
function toKidErrorCode(rawCode, status) {
  if (rawCode && rawCode in RAW_ERROR_TO_CODE) return RAW_ERROR_TO_CODE[rawCode];
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status >= 400 && status < 500) return "invalid_request";
  return "unavailable";
}
var DEFAULT_ERROR_MESSAGES = {
  invalidRequest: "The request was invalid.",
  invalidAgeSignal: "Provide a valid date of birth or age.",
  invalidJurisdiction: "Unknown or invalid jurisdiction code.",
  ageConflict: "The platform age signal conflicts with the provided age.",
  challengeIdRequired: "A challenge id is required.",
  challengeResolved: "This challenge is already resolved; no email can be sent.",
  emailMismatch: "The email address doesn't match this challenge's approver, or is required.",
  permissionNotChangeable: "That permission can't be changed here.",
  unauthorizedKey: "Invalid or unrecognized publishable key.",
  unauthorizedOrigin: "This origin isn't allowed for your publishable key.",
  sessionNotFound: "Session not found.",
  challengeNotFound: "Challenge not found.",
  rateLimited: "Too many requests. Please wait and try again.",
  serverError: "Something went wrong on our side. Please try again.",
  featureDisabled: "This feature isn't enabled for this product."
};
var INVALID_INPUT_SUBCASES = [
  { test: /invalid jurisdiction/i, key: "invalidJurisdiction" },
  { test: /dateofbirth|date of birth/i, key: "invalidAgeSignal" },
  { test: /challenge id must be provided/i, key: "challengeIdRequired" },
  { test: /completed challenge/i, key: "challengeResolved" }
];
function resolveErrorMessage(rawCode, rawMessage, status, keys, msgs) {
  switch (rawCode) {
    case "AGE_CONFLICT":
      return msgs.ageConflict;
    case "INVALID_EMAIL":
      return msgs.emailMismatch;
    case "FEATURE_DISABLED":
      return msgs.featureDisabled;
    case "TOO_MANY_REQUESTS":
      return msgs.rateLimited;
    case "UNAUTHORIZED":
      return status === 403 ? msgs.unauthorizedOrigin : msgs.unauthorizedKey;
    case "INTERNAL_ERROR":
      return msgs.serverError;
    case "NOT_FOUND":
      return msgs[keys.notFound ?? "sessionNotFound"];
  }
  if (status === 429) return msgs.rateLimited;
  if (status === 401 || status === 403) return status === 403 ? msgs.unauthorizedOrigin : msgs.unauthorizedKey;
  if (status >= 500 || status === 0) return msgs.serverError;
  const subcase = rawMessage ? INVALID_INPUT_SUBCASES.find((s) => s.test.test(rawMessage)) : void 0;
  return msgs[subcase?.key ?? keys.invalid ?? "invalidRequest"];
}
var KidError = class extends Error {
  constructor(status, code, message, rawCode, retryAfter) {
    super(message);
    this.status = status;
    this.code = code;
    this.rawCode = rawCode;
    this.retryAfter = retryAfter;
    this.name = "KidError";
  }
  status;
  code;
  rawCode;
  retryAfter;
};
function localKidError(code) {
  return new KidError(0, code, DEFAULT_ERROR_MESSAGES.invalidRequest, void 0);
}
function toKidError(e) {
  return e instanceof KidError ? e : new KidError(0, "unavailable", DEFAULT_ERROR_MESSAGES.serverError, void 0);
}
var retryAfterByBody = /* @__PURE__ */ new WeakMap();
function parseRetryAfter(header) {
  const value = header?.trim();
  if (!value || !/^\d+$/.test(value)) return void 0;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) ? seconds : void 0;
}
function fetchEventStream(doFetch) {
  return async (url, headers, signal, onHeaders, onText) => {
    const r = await doFetch(url, { method: "GET", headers, signal });
    const contentType = r.headers.get("content-type");
    onHeaders(r.status, r.body ? contentType : null);
    if (!r.ok || !r.body || !contentType?.startsWith("text/event-stream")) {
      return { status: r.status, text: JSON.stringify(await r.json().catch(() => ({}))) };
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      onText(decoder.decode(value, { stream: true }));
    }
    onText(decoder.decode());
    return { status: r.status, text: "" };
  };
}
function bearer(key) {
  return key ? { Authorization: `Bearer ${key}` } : {};
}
function createClient(options = {}) {
  const baseUrl = (options.baseUrl ?? "/fapi/v1").replace(/\/+$/, "");
  const doFetch = options.fetchImpl ?? fetch.bind(globalThis);
  const openEventStream = options.eventStream ?? fetchEventStream(doFetch);
  const hash = options.crypto ?? (globalThis.crypto?.subtle ? webCrypto : null);
  function kidError(status, data, keys = {}) {
    const code = toKidErrorCode(data.error, status);
    return new KidError(
      status,
      code,
      resolveErrorMessage(data.error, data.errorMessage, status, keys, DEFAULT_ERROR_MESSAGES),
      data.error,
      code === "rate_limited" ? retryAfterByBody.get(data) : void 0
    );
  }
  async function send(path, init) {
    let r;
    try {
      r = await doFetch(`${baseUrl}${path}`, {
        method: init.method,
        headers: {
          ...init.method === "POST" ? { "Content-Type": "application/json" } : {},
          ...bearer(options.publishableKey),
          ...options.headers,
          ...init.headers
        },
        ...init.method === "POST" ? { body: JSON.stringify(init.body ?? {}) } : {}
      });
    } catch {
      return { ok: false, status: 0, data: {}, etag: null };
    }
    const data = await r.json().catch(() => ({}));
    const retryAfter = r.status === 429 ? parseRetryAfter(r.headers?.get?.("retry-after")) : void 0;
    if (retryAfter !== void 0 && data && typeof data === "object") retryAfterByBody.set(data, retryAfter);
    return { ok: r.ok, status: r.status, data, etag: r.headers?.get?.("etag") ?? null, retryAfter };
  }
  const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(baseUrl);
  const clientTrust = options.publishableKey && options.deviceKeys && hash ? new ClientTrust(
    (path, init) => send(path, init),
    (path) => absolute ? `${baseUrl}${path}` : new URL(`${baseUrl}${path}`, options.baseURI?.()).href,
    options.deviceKeys,
    options.botCheck,
    options.attestation,
    hash
  ) : null;
  function tokenFailure(status, trust) {
    const failure = status === 401 && Object.keys(trust).length === 0 ? clientTrust?.tokenFailure() : null;
    if (!failure) return null;
    const data = { ...failure.data };
    if (failure.retryAfter !== void 0) retryAfterByBody.set(data, failure.retryAfter);
    return { ok: false, status: failure.status, data, etag: null, retryAfter: failure.retryAfter };
  }
  async function trusted(path, init) {
    const attempt = async () => {
      const trust = clientTrust ? await clientTrust.headers(init.method, path) : {};
      const sent = await send(path, {
        method: init.method,
        body: init.body,
        headers: { ...init.headers ?? {}, ...trust }
      });
      return tokenFailure(sent.status, trust) ?? sent;
    };
    const first = await attempt();
    if (!clientTrust || first.data?.error !== "CLIENT_TOKEN_INVALID") return first;
    clientTrust.invalidate();
    return attempt();
  }
  async function post(path, body) {
    return trusted(path, { method: "POST", body });
  }
  async function get(path, headers = {}) {
    return trusted(path, { method: "GET", headers });
  }
  return {
    async ageGateCheck(age, jurisdiction, platformAgeSignal) {
      const body = {
        ...age,
        ...jurisdiction ? { jurisdiction } : {},
        ...platformAgeSignal ? { platformAgeSignal } : {}
      };
      const { ok, status, data } = await post(
        "/age-gate/check",
        body
      );
      if (!ok) throw kidError(status, data, { invalid: "invalidAgeSignal" });
      return data;
    },
    // The server trusts a platform age signal only from an iOS app: any on a test key, an App Attest verified one on a
    // live key.
    async platformAgeSignalTrusted() {
      if (!options.platformAgeSignal || !clientTrust) return false;
      const trustLevel = await clientTrust.trustLevel();
      if (trustLevel === null) return false;
      return !options.publishableKey?.startsWith("kgp_live_") || trustLevel === "verified";
    },
    ...options.platformAgeSignal ? { platformAgeSignal: options.platformAgeSignal } : {},
    async getRequirements(jurisdiction) {
      const query = jurisdiction ? `?jurisdiction=${encodeURIComponent(jurisdiction)}` : "";
      const { ok, status, data } = await get(
        `/age-gate/get-requirements${query}`
      );
      if (!ok) throw kidError(status, data, { invalid: "invalidJurisdiction" });
      return data;
    },
    async sessionGet(sessionId, etag) {
      const {
        ok,
        status,
        data,
        etag: responseEtag
      } = await get(
        `/session/get?sessionId=${encodeURIComponent(sessionId)}`,
        etag ? { "If-None-Match": etag } : {}
      );
      if (status === 304) return { session: null, etag: etag ?? null, notModified: true };
      if (!ok) {
        const err = kidError(status, data, { notFound: "sessionNotFound" });
        if (err.code === "not_found") return { session: null, etag: null, notModified: false, notFound: err };
        throw err;
      }
      return { session: data, etag: data.etag ?? responseEtag, notModified: false };
    },
    async challengeGetStatus(challengeId) {
      const { ok, status, data } = await get(
        `/challenge/get-status?challengeId=${encodeURIComponent(challengeId)}`
      );
      if (!ok) throw kidError(status, data, { notFound: "challengeNotFound" });
      return data;
    },
    async challengeStream(challengeId, onStatus, signal) {
      const path = `/challenge/stream?challengeId=${encodeURIComponent(challengeId)}`;
      const parser = createSseParser(({ event, data }) => {
        if (event !== "status") return;
        let status;
        try {
          status = JSON.parse(data);
        } catch {
          return;
        }
        onStatus(status);
      });
      let streaming = false;
      let trust = {};
      const open = async () => {
        streaming = false;
        trust = clientTrust ? await clientTrust.headers("GET", path) : {};
        const headers = { Accept: "text/event-stream", ...bearer(options.publishableKey), ...options.headers, ...trust };
        return openEventStream(
          `${baseUrl}${path}`,
          headers,
          signal,
          (status, contentType) => {
            streaming = status >= 200 && status < 300 && !!contentType?.startsWith("text/event-stream");
          },
          (text) => {
            if (streaming) parser.push(text);
          }
        );
      };
      const refused = (res2) => {
        const failure = tokenFailure(res2.status, trust);
        if (failure) return kidError(failure.status, failure.data, { notFound: "challengeNotFound" });
        let data = {};
        try {
          data = JSON.parse(res2.text);
        } catch {
        }
        return kidError(res2.status, data, { notFound: "challengeNotFound" });
      };
      let res;
      try {
        res = await open();
        if (res.status >= 400) {
          const err = refused(res);
          if (!clientTrust || err.rawCode !== "CLIENT_TOKEN_INVALID") throw err;
          clientTrust.invalidate();
          res = await open();
        }
      } catch (e) {
        if (e instanceof KidError) throw e;
        if (streaming) return { closed: false };
        throw kidError(0, {});
      }
      if (res.status >= 400) throw refused(res);
      if (!streaming) throw kidError(0, {});
      return { closed: true, ...parser.retryMs !== void 0 ? { retryMs: parser.retryMs } : {} };
    },
    async challengeSendEmail(challengeId, email) {
      const body = { challengeId, ...email ? { email } : {} };
      const { ok, status, data } = await post("/challenge/send-email", body);
      if (ok) return { ok: true };
      return {
        ok: false,
        error: kidError(status, data, { notFound: "challengeNotFound", invalid: "challengeResolved" })
      };
    },
    async challengeInviteParent(sessionId, parentEmail, playerName) {
      const body = { sessionId, parentEmail, ...playerName ? { playerName } : {} };
      const { ok, status, data } = await post(
        "/challenge/invite-parent",
        body
      );
      if (!ok) throw kidError(status, data, { notFound: "sessionNotFound" });
      return data;
    },
    async sessionChange(sessionId, name, enabled) {
      const body = { sessionId, name, enabled };
      const { ok, status, data } = await post(
        "/session/change",
        body
      );
      if (ok) return { ok: true, session: data };
      return {
        ok: false,
        error: kidError(status, data, { notFound: "sessionNotFound", invalid: "permissionNotChangeable" })
      };
    },
    async sessionUpgrade(sessionId, permissionNames) {
      const body = {
        sessionId,
        requestedPermissions: permissionNames.map((name) => ({ name }))
      };
      const { ok, status, data } = await post(
        "/session/upgrade",
        body
      );
      if (!ok) throw kidError(status, data, { notFound: "sessionNotFound" });
      return { session: data.session, challenge: data.challenge ?? null };
    },
    async sessionVerifyAge(sessionId) {
      const body = { sessionId };
      const { ok, status, data } = await post("/session/verify-age", body);
      if (!ok) throw kidError(status, data, { notFound: "sessionNotFound" });
      return { status: data.status, challenge: data.challenge ?? null };
    },
    async declare(input) {
      let iconUrl = input.iconUrl;
      if (iconUrl) {
        try {
          iconUrl = options.readIcon ? await options.readIcon(iconUrl) : await declaredIconUrl(iconUrl, doFetch, options.baseURI?.());
        } catch (e) {
          throw new KidError(
            0,
            "invalid_request",
            e instanceof Error ? e.message : "Could not read the app icon.",
            void 0
          );
        }
      }
      const body = {
        permissions: input.permissions,
        ...input.privacyPolicyUrl !== void 0 ? { privacyPolicyUrl: input.privacyPolicyUrl } : {},
        ...input.termsOfServiceUrl !== void 0 ? { termsOfServiceUrl: input.termsOfServiceUrl } : {},
        ...iconUrl !== void 0 ? { iconUrl } : {},
        supportEmail: input.supportEmail
      };
      const { ok, status, data } = await post("/declare", body);
      if (!ok) {
        const code = toKidErrorCode(data.error, status);
        throw new KidError(
          status,
          code,
          data.errorMessage ?? data.error ?? "Declare failed.",
          data.error,
          code === "rate_limited" ? retryAfterByBody.get(data) : void 0
        );
      }
    }
  };
}

// ../core-sdk-js/src/core/challengeStream.ts
var MAX_FAILED_OPENS = 2;
var RECONNECT_BASE_MS = 1e3;
var RECONNECT_MAX_MS = 3e4;
var MIN_HEALTHY_STREAM_MS = 1e3;
function createChallengeWatch(options) {
  const now = options.now ?? (() => Date.now());
  const base = options.reconnectBaseMs ?? RECONNECT_BASE_MS;
  let challengeId = null;
  let fellBack = false;
  let watch = null;
  let timer = null;
  let failedOpens = 0;
  let backoff = base;
  let handled = Promise.resolve();
  function stop() {
    watch?.abort();
    watch = null;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }
  function retry(current, delay) {
    timer = setTimeout(() => {
      timer = null;
      if (watch === current) open(current);
    }, delay);
  }
  function retryWithBackoff(current) {
    retry(current, backoff);
    backoff = Math.min(backoff * 2, RECONNECT_MAX_MS);
  }
  function open(current) {
    const id = challengeId;
    if (!id) return;
    const openedAt = now();
    let snapshot = false;
    options.client.challengeStream(
      id,
      (status) => {
        snapshot = true;
        handled = handled.then(async () => {
          if (watch !== current) return;
          let keepWatching = true;
          try {
            keepWatching = await options.onStatus(status);
          } catch (e) {
            console.error("[k-ID] could not handle a challenge status; will retry", e);
          }
          if (!keepWatching && watch === current) stop();
        });
      },
      current.signal
    ).then(async (end) => {
      await handled;
      if (watch !== current) return;
      if (!snapshot) return failOpen(current);
      failedOpens = 0;
      if (end.closed && now() - openedAt >= MIN_HEALTHY_STREAM_MS) {
        backoff = base;
        retry(current, end.retryMs ?? 0);
        return;
      }
      retryWithBackoff(current);
    }).catch((e) => {
      if (watch !== current) return;
      failOpen(current, e.code === "not_found");
    });
  }
  function failOpen(current, unavailable = false) {
    failedOpens += 1;
    if (unavailable || failedOpens >= MAX_FAILED_OPENS) {
      stop();
      fellBack = true;
      options.onFallback();
      return;
    }
    retryWithBackoff(current);
  }
  return {
    start(id) {
      if (id !== challengeId) {
        stop();
        challengeId = id;
        fellBack = false;
        failedOpens = 0;
        backoff = base;
      }
      if (fellBack) return false;
      if (watch) return true;
      watch = new AbortController();
      open(watch);
      return true;
    },
    stop,
    get active() {
      return watch !== null;
    }
  };
}

// ../core-sdk-js/src/core/verifyAge.ts
var MIN_POLL_INTERVAL_MS = 3e4;
var MAX_POLL_BACKOFF_MS = 3e5;
function createVerifyAgeController(options) {
  const { client, sessionId, onSession } = options;
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h));
  const interval = Math.max(MIN_POLL_INTERVAL_MS, options.pollIntervalMs ?? MIN_POLL_INTERVAL_MS);
  let started = false;
  let checked = false;
  let polling = false;
  let confirming = false;
  let confirmation = 0;
  let collectedEmail;
  let backoff = interval;
  let timer = null;
  let fallbackDelay = 0;
  const stream = createChallengeWatch({
    client,
    now,
    onStatus: async (status) => {
      const pending = await handleStatus(status);
      if (pending) schedule(Infinity);
      return pending;
    },
    onFallback: () => schedule(fallbackDelay)
  });
  let state = {
    status: "running",
    step: "checking",
    challengeId: null,
    rawChallengeStatus: null,
    expiresAt: null,
    error: null
  };
  const listeners = /* @__PURE__ */ new Set();
  function commit(patch) {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  }
  function stopTimer() {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  }
  function schedule(delay) {
    if (!started) return;
    stopTimer();
    if (state.expiresAt) {
      const remaining = Date.parse(state.expiresAt) - now();
      if (remaining <= 0) {
        finish("fail");
        return;
      }
      delay = Math.min(delay, remaining);
    }
    if (Number.isFinite(delay)) timer = setTimer(poll, delay);
  }
  function watch(delay) {
    if (!started || !state.challengeId) return;
    fallbackDelay = delay;
    schedule(stream.start(state.challengeId) ? Infinity : delay);
  }
  function finish(status, detail) {
    if (status === "error") console.error("[k-ID] age verification error", detail);
    stopTimer();
    stream.stop();
    commit({
      status,
      step: null,
      rawChallengeStatus: status === "fail" ? "fail" : state.rawChallengeStatus,
      error: status === "error" ? toKidError(detail) : null
    });
  }
  function scheduleConfirm(delay) {
    if (!started) return;
    stopTimer();
    timer = setTimer(() => {
      timer = null;
      void confirmPass();
    }, delay);
  }
  async function confirmPass() {
    const id = ++confirmation;
    confirming = true;
    let verifiedAge;
    let civilAge;
    try {
      const read = await client.sessionGet(sessionId);
      if (id !== confirmation) return;
      if (read.session) onSession?.(read.session);
      verifiedAge = read.session?.ageVerification?.verifiedAge;
      civilAge = await options.civilAge();
      if (id !== confirmation) return;
    } catch (e) {
      if (id !== confirmation) return;
      console.error("[k-ID] could not re-read the session after verifying age; will retry", e);
      backoff = Math.min(backoff * 2, MAX_POLL_BACKOFF_MS);
      commit({ status: "error", step: null, error: toKidError(e) });
      scheduleConfirm(backoff);
      return;
    }
    confirming = false;
    backoff = interval;
    if (verifiedAge !== void 0 && civilAge !== void 0 && verifiedAge >= civilAge) {
      commit({ status: "pass", step: null, error: null, rawChallengeStatus: state.challengeId ? "pass" : null });
      return;
    }
    finish("fail");
  }
  async function check() {
    checked = true;
    try {
      const res = await client.sessionVerifyAge(sessionId);
      if (res.status === "PASS") {
        await confirmPass();
        return;
      }
      if (res.status === "FAIL") {
        finish("fail");
        return;
      }
      if (!res.challenge) {
        finish("error", "challenge without an id");
        return;
      }
      commit({ step: "email", challengeId: res.challenge.challengeId, rawChallengeStatus: "pending" });
    } catch (e) {
      finish("error", e);
    }
  }
  async function poll() {
    timer = null;
    polling = true;
    try {
      await pollOnce();
    } finally {
      polling = false;
    }
  }
  async function pollOnce() {
    const challengeId = state.challengeId;
    if (!challengeId) return;
    try {
      const status = await client.challengeGetStatus(challengeId);
      backoff = interval;
      if (await handleStatus(status)) schedule(stream.active ? Infinity : interval);
    } catch (e) {
      console.error("[k-ID] age verification poll failed; will retry", e);
      backoff = Math.min(backoff * 2, MAX_POLL_BACKOFF_MS);
      schedule(stream.active ? Infinity : backoff);
    }
  }
  async function handleStatus(status) {
    if (status.status === "PASS") {
      stopTimer();
      stream.stop();
      await confirmPass();
      return false;
    }
    if (status.status === "FAIL" || status.expiresAt && now() > Date.parse(status.expiresAt)) {
      finish("fail");
      return false;
    }
    commit({
      rawChallengeStatus: status.status === "IN_PROGRESS" ? "in-progress" : "pending",
      expiresAt: status.expiresAt ?? null
    });
    return true;
  }
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (state.status === "fail" || state.status === "error" && !confirming) {
        stopTimer();
        started = true;
        backoff = interval;
        commit({
          status: "running",
          step: "checking",
          challengeId: null,
          rawChallengeStatus: null,
          expiresAt: null,
          error: null
        });
        void check();
        return;
      }
      if (started) return;
      started = true;
      if (!checked) {
        void check();
        return;
      }
      if (polling || timer !== null || stream.active) return;
      if (confirming) scheduleConfirm(0);
      else if (state.status === "pending") watch(0);
    },
    setEmail(email) {
      collectedEmail = email;
    },
    async submit() {
      const challengeId = state.challengeId;
      if (!challengeId || state.status !== "running" && state.status !== "pending") {
        console.warn("[k-ID] submit() called before a challenge exists; nothing to send.");
        return { ok: false, error: localKidError("invalid_request") };
      }
      const email = collectedEmail;
      if (!email) {
        console.warn(
          "[k-ID] submit() called without an email; pass one to `verifyAge.submit` or render <KidSessionVerifyAge>."
        );
        return { ok: false, error: localKidError("invalid_request") };
      }
      const res = await client.challengeSendEmail(challengeId, email);
      if (!res.ok) {
        console.error("[k-ID] could not send the verification email", res.error);
        return { ok: false, error: res.error };
      }
      backoff = interval;
      commit({ status: "pending", step: null });
      watch(interval);
      return { ok: true };
    },
    destroy() {
      stopTimer();
      stream.stop();
      started = false;
    }
  };
}

// ../core-sdk-js/src/core/ageGate.ts
var MIN_POLL_INTERVAL_MS2 = 3e4;
var MAX_POLL_BACKOFF_MS2 = 3e5;
var MAX_CHECK_ATTEMPTS = 3;
var CHECK_RETRY_MS = 1e3;
function resumableChallengeId(state) {
  return state.status === "pending" ? state.challengeId : null;
}
var CONSENT_TYPE_MARKER = "PARENTAL_CONSENT";
var ASSURANCE_TYPE_MARKER = "AGE_GATE_AGE_ASSURANCE";
function isConsentChallenge(type) {
  return !type || type.includes(CONSENT_TYPE_MARKER);
}
function isAssuranceChallenge(type) {
  return !!type && type.includes(ASSURANCE_TYPE_MARKER);
}
function challengeKindOf(type) {
  if (isConsentChallenge(type)) return "parentalConsent";
  if (isAssuranceChallenge(type)) return "ageAssurance";
  return null;
}
function platformAgeGates(requirements) {
  function gates(ages) {
    const sorted = [...new Set(ages.filter((a) => a !== void 0 && a > 0))].sort((a, b) => a - b);
    return sorted.every((gate, i) => gate - (sorted[i - 1] ?? 0) >= 2) ? sorted : null;
  }
  return gates([requirements.minimumAge, requirements.accessAge, requirements.civilAge]) ?? gates([requirements.accessAge, requirements.civilAge]) ?? [];
}
function sameAge(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
function createAgeGateController(options) {
  const { client } = options;
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h));
  const interval = Math.max(MIN_POLL_INTERVAL_MS2, options.pollIntervalMs ?? MIN_POLL_INTERVAL_MS2);
  const initial = options.initial ?? {};
  const resuming = Boolean(initial.challengeId || initial.sessionId);
  const prop = { jurisdiction: initial.jurisdiction, age: initial.age, email: initial.email };
  const collected = {};
  let locked = resuming;
  let lockedJurisdiction = initial.jurisdiction;
  let lockedAge = initial.age;
  let checked = resuming;
  let checking = false;
  let started = false;
  let resumeStarted = false;
  let polling = false;
  let requirementsFetched = false;
  let autoResolveFailed = false;
  let checkAttempts = 0;
  let warnedLock = false;
  let etag = null;
  let backoff = interval;
  let timer = null;
  const platformAgeSignal = options.platformAgeSignal ?? client.platformAgeSignal;
  let platformAsked = false;
  let askingPlatform = false;
  let platformSignal = null;
  let unsubscribeSessions = null;
  let fallbackDelay = 0;
  const stream = createChallengeWatch({
    client,
    now,
    onStatus: async (status) => {
      const pending = await handleStatus(status);
      if (pending) scheduleWithinDeadline(Infinity);
      return pending;
    },
    onFallback: () => scheduleWithinDeadline(fallbackDelay)
  });
  let state = {
    status: initial.challengeId ? "pending" : "running",
    step: null,
    challengeId: initial.challengeId ?? null,
    challengeKind: null,
    sessionId: initial.sessionId ?? null,
    session: null,
    claimToken: null,
    rawChallengeStatus: initial.challengeId ? "pending" : null,
    expiresAt: null,
    requirements: null,
    emailProvided: initial.email !== void 0,
    error: null
  };
  state = { ...state, step: computeStep(state) };
  const listeners = /* @__PURE__ */ new Set();
  function emit() {
    for (const l of listeners) l();
  }
  let verifyAge = null;
  function syncVerifyAge() {
    const sessionId = state.status === "pass" ? state.sessionId : null;
    if (!sessionId || verifyAge?.sessionId === sessionId) return;
    verifyAge?.controller.destroy();
    verifyAge = {
      sessionId,
      controller: createVerifyAgeController({
        client,
        sessionId,
        civilAge: sessionCivilAge,
        onSession: (session) => {
          etag = null;
          commit({ session });
        },
        pollIntervalMs: options.pollIntervalMs,
        now: options.now,
        setTimer: options.setTimer,
        clearTimer: options.clearTimer
      })
    };
  }
  async function sessionCivilAge() {
    if (state.requirements) return state.requirements.civilAge;
    const jurisdiction = state.session?.jurisdiction;
    if (!jurisdiction) return void 0;
    const requirements = await client.getRequirements(jurisdiction);
    commit({ requirements });
    return requirements.civilAge;
  }
  function fetchSessionRequirements(session) {
    if (state.requirements !== null || !session?.jurisdiction) return;
    void client.getRequirements(session.jurisdiction).then((requirements) => commit({ requirements })).catch((e) => console.error("[k-ID] could not load the requirements", e));
  }
  function effectiveJurisdiction() {
    return locked ? lockedJurisdiction : collected.jurisdiction ?? prop.jurisdiction;
  }
  function effectiveAge() {
    return locked ? lockedAge : prop.age ?? collected.age;
  }
  function effectiveEmail() {
    return prop.email ?? collected.email;
  }
  function jurisdictionArg() {
    const j = effectiveJurisdiction();
    return j && j.toLowerCase() !== "auto" ? j : void 0;
  }
  function needJurisdiction() {
    if (jurisdictionArg() !== void 0) return false;
    return effectiveJurisdiction() === void 0 || autoResolveFailed;
  }
  function computeStep({ status, challengeId, challengeKind }) {
    if (status !== "running") return null;
    if (needJurisdiction()) return "jurisdiction";
    if (challengeId) return challengeKind === "ageAssurance" ? "ageAssurance" : "parentalConsent";
    if (!checked && effectiveAge() === void 0 && platformSignal === null) {
      return platformAgeSignal && !platformAsked ? "checking" : "age";
    }
    return "checking";
  }
  function isCannotResolve(e) {
    return typeof e === "object" && e !== null && e.rawCode === "CANNOT_RESOLVE_JURISDICTION";
  }
  function commit(patch) {
    const prev = state.session;
    const next = { ...state, ...patch };
    state = { ...next, step: computeStep(next) };
    syncVerifyAge();
    emit();
    if (state.session && state.session !== prev) options.sessions?.publish(state.session);
  }
  function adoptSession(session) {
    if (session === state.session || session.sessionId !== state.sessionId) return;
    etag = null;
    commit({ session });
  }
  function catchUpSession() {
    const cached = state.session && state.sessionId ? options.sessions?.current(state.sessionId) : null;
    if (cached) adoptSession(cached);
  }
  function stopTimer() {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  }
  function schedule(delay) {
    if (!started) return;
    stopTimer();
    if (Number.isFinite(delay)) timer = setTimer(poll, delay);
  }
  function watch(delay) {
    if (!started || !state.challengeId) return;
    fallbackDelay = delay;
    scheduleWithinDeadline(stream.start(state.challengeId) ? Infinity : delay);
  }
  function rearm() {
    if (polling || timer !== null || stream.active || !state.challengeId || state.status !== "pending") return;
    backoff = interval;
    watch(0);
  }
  function scheduleWithinDeadline(delay) {
    if (state.expiresAt) {
      const remaining = Date.parse(state.expiresAt) - now();
      if (remaining <= 0) {
        commit({ rawChallengeStatus: "fail" });
        fail("fail", "challenge expired");
        return;
      }
      delay = Math.min(delay, remaining);
    }
    schedule(delay);
  }
  function maybeFetchRequirements() {
    if (!started || requirementsFetched) return;
    if (jurisdictionArg() === void 0 && (effectiveJurisdiction() === void 0 || autoResolveFailed)) return;
    requirementsFetched = true;
    void client.getRequirements(jurisdictionArg()).then((requirements) => {
      commit({ requirements });
      maybeAskPlatform(requirements);
      maybeCheck();
    }).catch((e) => {
      if (jurisdictionArg() === void 0 && isCannotResolve(e)) {
        autoResolveFailed = true;
        requirementsFetched = false;
        commit({});
        return;
      }
      fail("error", e);
    });
  }
  function maybeAskPlatform(requirements) {
    const ask = platformAgeSignal;
    if (!ask || platformAsked) return;
    platformAsked = true;
    const gates = platformAgeGates(requirements);
    if (effectiveAge() !== void 0 || !requirements.approvedAgeCollectionMethods.includes("platform-account") || gates.length === 0) {
      commit({});
      return;
    }
    askingPlatform = true;
    void (async () => {
      if (await client.platformAgeSignalTrusted()) platformSignal = await ask(gates).catch(() => null);
      askingPlatform = false;
      commit({});
      maybeCheck();
    })();
  }
  function maybeCheck() {
    if (!started || checked || checking || resuming || askingPlatform) return;
    if (effectiveAge() === void 0 && platformSignal === null) return;
    if (state.requirements === null) return;
    void runCheck();
  }
  async function runCheck() {
    lockedJurisdiction = effectiveJurisdiction();
    lockedAge = effectiveAge();
    checking = true;
    locked = true;
    commit({ status: "running" });
    try {
      const res = await client.ageGateCheck(lockedAge, jurisdictionArg(), platformSignal ?? void 0);
      checked = true;
      checking = false;
      if (res.status === "PROHIBITED") {
        commit({ status: "prohibited", session: null, challengeId: null });
        return;
      }
      if (res.status === "PASS") {
        commit({
          status: "pass",
          session: res.session ?? null,
          sessionId: res.session?.sessionId ?? null,
          challengeId: null,
          claimToken: res.claimToken ?? null
        });
        return;
      }
      const kind = res.challenge ? challengeKindOf(res.challenge.type) : null;
      if (res.challenge && kind) {
        commit({
          status: "running",
          challengeId: res.challenge.challengeId,
          challengeKind: kind,
          rawChallengeStatus: "pending",
          claimToken: res.claimToken ?? null
        });
        return;
      }
      fail(
        "error",
        res.challenge?.type ? `unsupported challenge type ${res.challenge.type}` : "challenge without an id"
      );
    } catch (e) {
      checking = false;
      const status = e.status;
      const transient = typeof status !== "number" || status >= 500;
      checkAttempts += 1;
      if (transient && checkAttempts < MAX_CHECK_ATTEMPTS) {
        if (!started) return;
        stopTimer();
        timer = setTimer(() => void runCheck(), CHECK_RETRY_MS);
        return;
      }
      checked = true;
      fail("error", e);
    }
  }
  function fail(status, detail) {
    if (status === "error") console.error("[k-ID] age gate error", detail);
    stopTimer();
    stream.stop();
    commit({ status, error: status === "error" ? toKidError(detail) : null });
  }
  async function submit() {
    const challengeId = state.challengeId;
    if (!challengeId) {
      console.warn("[k-ID] submit() called before a challenge exists; nothing to send.");
      return { ok: false, error: localKidError("invalid_request") };
    }
    const email = effectiveEmail();
    if (!email) {
      console.warn(
        "[k-ID] submit() called without an email; provide the `email` prop or render <KidAskAnAdult> / <KidVerifyAge>."
      );
      return { ok: false, error: localKidError("invalid_request") };
    }
    const res = await client.challengeSendEmail(challengeId, email).catch((e) => ({ ok: false, error: toKidError(e) }));
    if (res.ok) {
      backoff = interval;
      commit({ status: "pending", rawChallengeStatus: "pending" });
      watch(interval);
      return { ok: true };
    }
    console.error("[k-ID] could not send the challenge email", res.error);
    return { ok: false, error: res.error };
  }
  async function poll() {
    timer = null;
    polling = true;
    try {
      await pollOnce();
    } finally {
      polling = false;
    }
  }
  async function pollOnce() {
    const challengeId = state.challengeId;
    if (!challengeId) return;
    try {
      const status = await client.challengeGetStatus(challengeId);
      backoff = interval;
      if (await handleStatus(status)) scheduleWithinDeadline(stream.active ? Infinity : interval);
    } catch (e) {
      console.error("[k-ID] poll failed; will retry", e);
      backoff = Math.min(backoff * 2, MAX_POLL_BACKOFF_MS2);
      scheduleWithinDeadline(stream.active ? Infinity : backoff);
    }
  }
  async function handleStatus(status) {
    if (!state.challengeKind && status.type) {
      const kind = challengeKindOf(status.type);
      if (kind) commit({ challengeKind: kind });
    }
    if (status.status === "PASS") {
      const sessionId = status.sessionId ?? state.sessionId ?? null;
      let session = state.session;
      if (sessionId) {
        const read = await client.sessionGet(sessionId);
        etag = read.etag;
        session = read.session ?? session;
      }
      stopTimer();
      stream.stop();
      commit({ status: "pass", rawChallengeStatus: "pass", session, sessionId });
      fetchSessionRequirements(session);
      return false;
    }
    if (status.status === "FAIL") {
      commit({ rawChallengeStatus: "fail" });
      fail("fail", "challenge failed");
      return false;
    }
    if (status.expiresAt && now() > Date.parse(status.expiresAt)) {
      commit({ rawChallengeStatus: "fail" });
      fail("fail", "challenge expired");
      return false;
    }
    const raw = status.status === "IN_PROGRESS" ? "in-progress" : "pending";
    commit({ rawChallengeStatus: raw, expiresAt: status.expiresAt ?? null });
    return true;
  }
  async function refreshSession() {
    const sessionId = state.sessionId;
    if (!sessionId) return;
    const read = await client.sessionGet(sessionId, etag ?? void 0).catch((e) => {
      throw toKidError(e);
    });
    if (read.notModified) return;
    etag = read.etag;
    if (read.session) commit({ session: read.session });
  }
  async function resume() {
    if (initial.sessionId) {
      try {
        const read = await client.sessionGet(initial.sessionId);
        etag = read.etag;
        if (read.session) {
          commit({ status: "pass", rawChallengeStatus: "pass", session: read.session, sessionId: initial.sessionId });
          fetchSessionRequirements(read.session);
          return;
        }
        fail("error", "resumed session not found");
      } catch (e) {
        fail("error", e);
      }
      return;
    }
    if (initial.challengeId) {
      backoff = interval;
      watch(0);
    }
  }
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (started) return;
      started = true;
      unsubscribeSessions ??= options.sessions?.subscribe(adoptSession) ?? null;
      catchUpSession();
      if (resuming) {
        if (resumeStarted) rearm();
        else {
          resumeStarted = true;
          void resume();
        }
        return;
      }
      maybeFetchRequirements();
      maybeCheck();
      rearm();
    },
    configure(inputs) {
      if (resuming) return;
      prop.email = inputs.email;
      if (locked) {
        const jurisdictionChanged = inputs.jurisdiction !== void 0 && inputs.jurisdiction !== lockedJurisdiction;
        const ageChanged = inputs.age !== void 0 && !sameAge(inputs.age, lockedAge);
        if ((jurisdictionChanged || ageChanged) && !warnedLock) {
          warnedLock = true;
          console.warn("[k-ID] age/jurisdiction ignored: an active challenge already exists for this session.");
        }
        commit({ emailProvided: inputs.email !== void 0 });
        return;
      }
      prop.jurisdiction = inputs.jurisdiction;
      prop.age = inputs.age;
      maybeFetchRequirements();
      maybeCheck();
      commit({ emailProvided: inputs.email !== void 0 });
    },
    setJurisdiction(code) {
      if (locked) return;
      collected.jurisdiction = code;
      maybeFetchRequirements();
      maybeCheck();
      emit();
    },
    setAge(signal) {
      if (locked) return;
      collected.age = signal;
      maybeCheck();
      emit();
    },
    setEmail(email) {
      collected.email = email;
      emit();
    },
    submit,
    refreshSession,
    declarationFailed(error) {
      commit({ status: "error", error: toKidError(error) });
    },
    sessionVerifyAge: () => verifyAge?.controller ?? null,
    destroy() {
      verifyAge?.controller.destroy();
      stopTimer();
      unsubscribeSessions?.();
      unsubscribeSessions = null;
      stream.stop();
      started = false;
    }
  };
}

// ../core-sdk-js/src/core/askWatcher.ts
var MIN_POLL_INTERVAL_MS3 = 3e4;
var MAX_POLL_BACKOFF_MS3 = 3e5;
function settingsChallengeKindOf(type) {
  if (!type) return null;
  if (type === "CHALLENGE_SESSION_UPGRADE_BY_AGE_ASSURANCE") return "ageAssurance";
  if (type === "CHALLENGE_SESSION_UPGRADE" || type.includes("PARENTAL_CONSENT")) return "parentalConsent";
  return null;
}
function createAskWatcher(options) {
  const { client } = options;
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h));
  const interval = Math.max(MIN_POLL_INTERVAL_MS3, options.pollIntervalMs ?? MIN_POLL_INTERVAL_MS3);
  let started = false;
  const asks = /* @__PURE__ */ new Map();
  const polling = /* @__PURE__ */ new Map();
  const rereads = /* @__PURE__ */ new Map();
  const streamed = /* @__PURE__ */ new Map();
  const fallbackDelays = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  function emit() {
    for (const l of listeners) l();
  }
  function update(sessionId, patch) {
    const ask = asks.get(sessionId);
    if (!ask) return;
    asks.set(sessionId, { ...ask, ...patch });
    emit();
  }
  function pollingFor(sessionId) {
    let p = polling.get(sessionId);
    if (!p) {
      p = {
        backoff: interval,
        timer: null,
        inFlight: false,
        granted: false,
        stream: createChallengeWatch({
          client,
          now,
          onStatus: (status) => handleStatus(sessionId, streamed.get(sessionId) ?? "", status),
          onFallback: () => schedule(sessionId, fallbackDelays.get(sessionId) ?? interval)
        })
      };
      polling.set(sessionId, p);
    }
    return p;
  }
  function stopTimer(p) {
    if (p.timer !== null) {
      clearTimer(p.timer);
      p.timer = null;
    }
  }
  function schedule(sessionId, delay) {
    if (!started) return;
    const p = pollingFor(sessionId);
    stopTimer(p);
    p.timer = setTimer(() => void poll(sessionId), delay);
  }
  function watchAsk(sessionId, delay) {
    const ask = asks.get(sessionId);
    if (!started || !ask || ask.status !== "pending") return;
    fallbackDelays.set(sessionId, delay);
    streamed.set(sessionId, ask.challengeId);
    if (!pollingFor(sessionId).stream.start(ask.challengeId)) schedule(sessionId, delay);
  }
  const isCurrent = (sessionId, challengeId) => asks.get(sessionId)?.challengeId === challengeId;
  async function reread(sessionId) {
    const attached = rereads.get(sessionId);
    if (attached) return attached();
    try {
      const read = await client.sessionGet(sessionId);
      if (read.session) options.sessions?.publish(read.session);
      return true;
    } catch (e) {
      console.error("[k-ID] could not load the session", e);
      return false;
    }
  }
  async function finishGranted(sessionId, challengeId, p) {
    p.granted = true;
    const read = await reread(sessionId);
    if (!isCurrent(sessionId, challengeId)) return;
    if (!read) {
      p.backoff = Math.min(p.backoff * 2, MAX_POLL_BACKOFF_MS3);
      schedule(sessionId, p.backoff);
      return;
    }
    p.granted = false;
    asks.delete(sessionId);
    emit();
  }
  async function handleStatus(sessionId, challengeId, status) {
    const ask = asks.get(sessionId);
    if (!ask || ask.challengeId !== challengeId || ask.status !== "pending") return false;
    const p = pollingFor(sessionId);
    p.backoff = interval;
    if (ask.permissions.length === 0 && status.permissions?.length) {
      update(sessionId, { permissions: status.permissions });
    }
    const challengeKind = settingsChallengeKindOf(status.type);
    if (challengeKind && challengeKind !== ask.challengeKind) update(sessionId, { challengeKind });
    if (status.status === "PASS") {
      await finishGranted(sessionId, challengeId, p);
      return false;
    }
    if (status.status === "FAIL" || status.expiresAt && now() > Date.parse(status.expiresAt)) {
      update(sessionId, { status: "error" });
      return false;
    }
    return true;
  }
  async function poll(sessionId) {
    const p = pollingFor(sessionId);
    p.timer = null;
    p.inFlight = true;
    try {
      await pollOnce(sessionId, p);
    } finally {
      p.inFlight = false;
    }
  }
  async function pollOnce(sessionId, p) {
    const ask = asks.get(sessionId);
    if (!ask || ask.status !== "pending") return;
    if (p.granted) return finishGranted(sessionId, ask.challengeId, p);
    try {
      const status = await client.challengeGetStatus(ask.challengeId);
      if (await handleStatus(sessionId, ask.challengeId, status)) schedule(sessionId, interval);
    } catch (e) {
      console.error("[k-ID] could not check for the grownup's answer; will retry", e);
      if (!isCurrent(sessionId, ask.challengeId)) return;
      p.backoff = Math.min(p.backoff * 2, MAX_POLL_BACKOFF_MS3);
      schedule(sessionId, p.backoff);
    }
  }
  return {
    get: (sessionId) => asks.get(sessionId) ?? null,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    watch(sessionId, challengeId, permissions, delay, challengeKind = null) {
      asks.set(sessionId, { status: "pending", challengeId, permissions, challengeKind });
      const p = pollingFor(sessionId);
      p.backoff = interval;
      p.granted = false;
      stopTimer(p);
      emit();
      watchAsk(sessionId, delay ?? interval);
    },
    clear(sessionId) {
      const p = polling.get(sessionId);
      if (p) {
        stopTimer(p);
        p.stream.stop();
      }
      if (asks.delete(sessionId)) emit();
    },
    attach(sessionId, fn) {
      rereads.set(sessionId, fn);
      return () => {
        if (rereads.get(sessionId) === fn) rereads.delete(sessionId);
      };
    },
    start() {
      if (started) return;
      started = true;
      for (const sessionId of asks.keys()) {
        const p = pollingFor(sessionId);
        if (!p.inFlight && !p.stream.active) watchAsk(sessionId, 0);
      }
    },
    stop() {
      for (const p of polling.values()) {
        stopTimer(p);
        p.stream.stop();
      }
      started = false;
    }
  };
}

// ../core-sdk-js/src/core/settings.ts
var PLAYER_EMAIL_NEEDED = "The player's email is needed to verify their age.";
function createSettingsController(options) {
  const { client, initial, onChallenge } = options;
  const asks = options.asks ?? createAskWatcher({
    client,
    sessions: options.sessions,
    pollIntervalMs: options.pollIntervalMs,
    now: options.now,
    setTimer: options.setTimer,
    clearTimer: options.clearTimer
  });
  const ownsAsks = !options.asks;
  let started = false;
  let resumed = false;
  let etag = null;
  let unsubscribeSessions = null;
  let unsubscribeAsks = null;
  let detachAsks = null;
  let local = initial.challengeId ? { status: "pending", permissions: [], challengeId: initial.challengeId, challengeKind: null } : null;
  let state = {
    session: null,
    isLoaded: false,
    error: null,
    challenge: challengeState()
  };
  function challengeState() {
    if (local) return local;
    const ask = asks.get(initial.sessionId);
    if (ask) {
      return {
        status: ask.status,
        permissions: ask.permissions,
        challengeId: ask.challengeId,
        challengeKind: ask.challengeKind
      };
    }
    return { status: "idle", permissions: [], challengeId: null, challengeKind: null };
  }
  const listeners = /* @__PURE__ */ new Set();
  function emit() {
    for (const l of listeners) l();
  }
  function commit(patch) {
    const prev = state.session;
    state = { ...state, ...patch };
    emit();
    if (state.session && state.session !== prev) options.sessions?.publish(state.session);
  }
  function adoptSession(session) {
    if (session === state.session || session.sessionId !== initial.sessionId) return;
    etag = null;
    commit({ session, isLoaded: true, error: null });
  }
  function catchUpSession() {
    const cached = state.session ? options.sessions?.current(initial.sessionId) : null;
    if (cached) adoptSession(cached);
  }
  function syncChallenge() {
    commit({ challenge: challengeState() });
  }
  function setLocal(next) {
    local = next;
    syncChallenge();
  }
  async function loadSession() {
    try {
      const read = await client.sessionGet(initial.sessionId, etag ?? void 0);
      if (read.notModified) return true;
      if (!read.session) {
        commit({ error: read.notFound ?? toKidError(void 0) });
        return true;
      }
      etag = read.etag;
      commit({ session: read.session, isLoaded: true, error: null });
      return true;
    } catch (e) {
      console.error("[k-ID] could not load the session", e);
      commit({ error: toKidError(e) });
      return false;
    }
  }
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (started) return;
      started = true;
      unsubscribeSessions ??= options.sessions?.subscribe(adoptSession) ?? null;
      catchUpSession();
      unsubscribeAsks ??= asks.subscribe(syncChallenge);
      detachAsks ??= asks.attach(initial.sessionId, loadSession);
      if (ownsAsks) asks.start();
      void loadSession();
      if (!resumed) {
        resumed = true;
        if (initial.challengeId && !asks.get(initial.sessionId)) {
          asks.watch(initial.sessionId, initial.challengeId, [], 0);
        }
        local = null;
      }
      syncChallenge();
    },
    async change(name, enabled) {
      const res = await client.sessionChange(initial.sessionId, name, enabled);
      if (!res.ok) return { ok: false, error: res.error };
      etag = null;
      commit({ session: res.session, isLoaded: true, error: null });
      return { ok: true };
    },
    async upgrade(names, approverEmail) {
      asks.clear(initial.sessionId);
      setLocal({ status: "sending", permissions: names, challengeId: null, challengeKind: null });
      let challengeKind = null;
      try {
        const { challenge } = await client.sessionUpgrade(initial.sessionId, names);
        if (!challenge) {
          await loadSession();
          setLocal(null);
          return { ok: true };
        }
        challengeKind = settingsChallengeKindOf(challenge.type);
        if (challengeKind === "ageAssurance" && !approverEmail) {
          setLocal({ status: "error", permissions: names, challengeId: null, challengeKind });
          return { ok: false, error: new KidError(0, "invalid_request", PLAYER_EMAIL_NEEDED, void 0) };
        }
        const sent = await client.challengeSendEmail(challenge.challengeId, approverEmail);
        if (!sent.ok) {
          setLocal({ status: "error", permissions: names, challengeId: challenge.challengeId, challengeKind });
          return { ok: false, error: sent.error };
        }
        onChallenge?.(challenge.challengeId);
        local = null;
        asks.watch(initial.sessionId, challenge.challengeId, names, void 0, challengeKind);
        return { ok: true };
      } catch (e) {
        console.error("[k-ID] could not start the settings challenge", e);
        setLocal({ status: "error", permissions: names, challengeId: null, challengeKind });
        return { ok: false, error: toKidError(e) };
      }
    },
    async refresh() {
      await loadSession();
    },
    destroy() {
      if (ownsAsks) asks.stop();
      detachAsks?.();
      detachAsks = null;
      unsubscribeAsks?.();
      unsubscribeAsks = null;
      unsubscribeSessions?.();
      unsubscribeSessions = null;
      started = false;
    }
  };
}

// ../core-sdk-js/src/core/sessionStore.ts
function createSessionStore() {
  const latest = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  return {
    publish(session) {
      if (latest.get(session.sessionId) === session) return;
      latest.set(session.sessionId, session);
      for (const l of listeners) l(session);
    },
    current: (sessionId) => latest.get(sessionId) ?? null,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

// ../core-sdk-js/src/strings.ts
var DEFAULT_STRINGS = en;
function mergeStrings(overrides) {
  if (!overrides) return DEFAULT_STRINGS;
  return {
    jurisdiction: { ...DEFAULT_STRINGS.jurisdiction, ...overrides.jurisdiction },
    age: { ...DEFAULT_STRINGS.age, ...overrides.age },
    askAnAdult: { ...DEFAULT_STRINGS.askAnAdult, ...overrides.askAnAdult },
    verifyAge: { ...DEFAULT_STRINGS.verifyAge, ...overrides.verifyAge },
    settings: { ...DEFAULT_STRINGS.settings, ...overrides.settings },
    subdivisions: { ...DEFAULT_STRINGS.subdivisions, ...overrides.subdivisions },
    permissions: mergePermissions(overrides.permissions)
  };
}
function mergePermissions(overrides) {
  const merged = { ...DEFAULT_STRINGS.permissions };
  for (const [name, copy] of Object.entries(overrides ?? {})) {
    merged[name] = { ...merged[name] ?? { name }, ...copy };
  }
  return merged;
}
var RTL_LANGUAGES = ["ar", "fa", "he", "ur"];
function textDirection(locale) {
  if (!locale) return void 0;
  const language = locale.split(/[-_]/)[0]?.toLowerCase() ?? "";
  return RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";
}
function format(template, vars) {
  return template.replace(/\{(\w+)\}/g, (whole, key) => key in vars ? String(vars[key]) : whole);
}

// ../core-sdk-js/src/jurisdictions.ts
var COUNTRIES = [
  { code: "AD", name: "Andorra" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "AF", name: "Afghanistan" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AI", name: "Anguilla" },
  { code: "AL", name: "Albania" },
  { code: "AM", name: "Armenia" },
  { code: "AO", name: "Angola" },
  { code: "AQ", name: "Antarctica" },
  { code: "AR", name: "Argentina" },
  { code: "AS", name: "American Samoa" },
  { code: "AT", name: "Austria" },
  { code: "AU", name: "Australia" },
  { code: "AW", name: "Aruba" },
  { code: "AX", name: "Aland Islands" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BB", name: "Barbados" },
  { code: "BD", name: "Bangladesh" },
  { code: "BE", name: "Belgium" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BG", name: "Bulgaria" },
  { code: "BH", name: "Bahrain" },
  { code: "BI", name: "Burundi" },
  { code: "BJ", name: "Benin" },
  { code: "BL", name: "Saint Barthelemy" },
  { code: "BM", name: "Bermuda" },
  { code: "BN", name: "Brunei Darussalam" },
  { code: "BO", name: "Bolivia" },
  { code: "BQ", name: "Bonaire, Sint Eustatius and Saba" },
  { code: "BR", name: "Brazil" },
  { code: "BS", name: "Bahamas" },
  { code: "BT", name: "Bhutan" },
  { code: "BV", name: "Bouvet Island" },
  { code: "BW", name: "Botswana" },
  { code: "BY", name: "Belarus" },
  { code: "BZ", name: "Belize" },
  { code: "CA", name: "Canada" },
  { code: "CC", name: "Cocos (Keeling) Islands" },
  { code: "CD", name: "Congo (Democratic Republic)" },
  { code: "CF", name: "Central African Republic" },
  { code: "CG", name: "Congo" },
  { code: "CH", name: "Switzerland" },
  { code: "CI", name: "Cote d'Ivoire" },
  { code: "CK", name: "Cook Islands" },
  { code: "CL", name: "Chile" },
  { code: "CM", name: "Cameroon" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "CU", name: "Cuba" },
  { code: "CV", name: "Cabo Verde" },
  { code: "CW", name: "Curacao" },
  { code: "CX", name: "Christmas Island" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia" },
  { code: "DE", name: "Germany" },
  { code: "DJ", name: "Djibouti" },
  { code: "DK", name: "Denmark" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "DZ", name: "Algeria" },
  { code: "EC", name: "Ecuador" },
  { code: "EE", name: "Estonia" },
  { code: "EG", name: "Egypt" },
  { code: "EH", name: "Western Sahara" },
  { code: "ER", name: "Eritrea" },
  { code: "ES", name: "Spain" },
  { code: "ET", name: "Ethiopia" },
  { code: "FI", name: "Finland" },
  { code: "FJ", name: "Fiji" },
  { code: "FK", name: "Falkland Islands" },
  { code: "FM", name: "Micronesia" },
  { code: "FO", name: "Faroe Islands" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GB", name: "United Kingdom" },
  { code: "GD", name: "Grenada" },
  { code: "GE", name: "Georgia" },
  { code: "GF", name: "French Guiana" },
  { code: "GG", name: "Guernsey" },
  { code: "GH", name: "Ghana" },
  { code: "GI", name: "Gibraltar" },
  { code: "GL", name: "Greenland" },
  { code: "GM", name: "Gambia" },
  { code: "GN", name: "Guinea" },
  { code: "GP", name: "Guadeloupe" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "GR", name: "Greece" },
  { code: "GS", name: "South Georgia and the South Sandwich Islands" },
  { code: "GT", name: "Guatemala" },
  { code: "GU", name: "Guam" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HK", name: "Hong Kong" },
  { code: "HM", name: "Heard Island and McDonald Islands" },
  { code: "HN", name: "Honduras" },
  { code: "HR", name: "Croatia" },
  { code: "HT", name: "Haiti" },
  { code: "HU", name: "Hungary" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IM", name: "Isle of Man" },
  { code: "IN", name: "India" },
  { code: "IO", name: "British Indian Ocean Territory" },
  { code: "IQ", name: "Iraq" },
  { code: "IR", name: "Iran" },
  { code: "IS", name: "Iceland" },
  { code: "IT", name: "Italy" },
  { code: "JE", name: "Jersey" },
  { code: "JM", name: "Jamaica" },
  { code: "JO", name: "Jordan" },
  { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "KH", name: "Cambodia" },
  { code: "KI", name: "Kiribati" },
  { code: "KM", name: "Comoros" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "KP", name: "Korea (Democratic People's Republic)" },
  { code: "KR", name: "Korea (Republic of)" },
  { code: "KW", name: "Kuwait" },
  { code: "KY", name: "Cayman Islands" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "LA", name: "Lao People's Democratic Republic" },
  { code: "LB", name: "Lebanon" },
  { code: "LC", name: "Saint Lucia" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LK", name: "Sri Lanka" },
  { code: "LR", name: "Liberia" },
  { code: "LS", name: "Lesotho" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "LV", name: "Latvia" },
  { code: "LY", name: "Libya" },
  { code: "MA", name: "Morocco" },
  { code: "MC", name: "Monaco" },
  { code: "MD", name: "Moldova" },
  { code: "ME", name: "Montenegro" },
  { code: "MF", name: "Saint Martin (French part)" },
  { code: "MG", name: "Madagascar" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MK", name: "North Macedonia" },
  { code: "ML", name: "Mali" },
  { code: "MM", name: "Myanmar" },
  { code: "MN", name: "Mongolia" },
  { code: "MO", name: "Macao" },
  { code: "MP", name: "Northern Mariana Islands" },
  { code: "MQ", name: "Martinique" },
  { code: "MR", name: "Mauritania" },
  { code: "MS", name: "Montserrat" },
  { code: "MT", name: "Malta" },
  { code: "MU", name: "Mauritius" },
  { code: "MV", name: "Maldives" },
  { code: "MW", name: "Malawi" },
  { code: "MX", name: "Mexico" },
  { code: "MY", name: "Malaysia" },
  { code: "MZ", name: "Mozambique" },
  { code: "NA", name: "Namibia" },
  { code: "NC", name: "New Caledonia" },
  { code: "NE", name: "Niger" },
  { code: "NF", name: "Norfolk Island" },
  { code: "NG", name: "Nigeria" },
  { code: "NI", name: "Nicaragua" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "NP", name: "Nepal" },
  { code: "NR", name: "Nauru" },
  { code: "NU", name: "Niue" },
  { code: "NZ", name: "New Zealand" },
  { code: "OM", name: "Oman" },
  { code: "PA", name: "Panama" },
  { code: "PE", name: "Peru" },
  { code: "PF", name: "French Polynesia" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PH", name: "Philippines" },
  { code: "PK", name: "Pakistan" },
  { code: "PL", name: "Poland" },
  { code: "PM", name: "Saint Pierre and Miquelon" },
  { code: "PN", name: "Pitcairn" },
  { code: "PR", name: "Puerto Rico" },
  { code: "PS", name: "Palestine" },
  { code: "PT", name: "Portugal" },
  { code: "PW", name: "Palau" },
  { code: "PY", name: "Paraguay" },
  { code: "QA", name: "Qatar" },
  { code: "RE", name: "Reunion" },
  { code: "RO", name: "Romania" },
  { code: "RS", name: "Serbia" },
  { code: "RU", name: "Russian Federation" },
  { code: "RW", name: "Rwanda" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SC", name: "Seychelles" },
  { code: "SD", name: "Sudan" },
  { code: "SE", name: "Sweden" },
  { code: "SG", name: "Singapore" },
  { code: "SH", name: "Saint Helena, Ascension and Tristan da Cunha" },
  { code: "SI", name: "Slovenia" },
  { code: "SJ", name: "Svalbard and Jan Mayen" },
  { code: "SK", name: "Slovakia" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SM", name: "San Marino" },
  { code: "SN", name: "Senegal" },
  { code: "SO", name: "Somalia" },
  { code: "SR", name: "Suriname" },
  { code: "SS", name: "South Sudan" },
  { code: "ST", name: "Sao Tome and Principe" },
  { code: "SV", name: "El Salvador" },
  { code: "SX", name: "Sint Maarten (Dutch part)" },
  { code: "SY", name: "Syrian Arab Republic" },
  { code: "SZ", name: "Eswatini" },
  { code: "TC", name: "Turks and Caicos Islands" },
  { code: "TD", name: "Chad" },
  { code: "TF", name: "French Southern Territories" },
  { code: "TG", name: "Togo" },
  { code: "TH", name: "Thailand" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TK", name: "Tokelau" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TN", name: "Tunisia" },
  { code: "TO", name: "Tonga" },
  { code: "TR", name: "Turkiye" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TV", name: "Tuvalu" },
  { code: "TW", name: "Taiwan" },
  { code: "TZ", name: "Tanzania" },
  { code: "UA", name: "Ukraine" },
  { code: "UG", name: "Uganda" },
  { code: "UM", name: "United States Minor Outlying Islands" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VA", name: "Holy See" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "VE", name: "Venezuela" },
  { code: "VG", name: "Virgin Islands (British)" },
  { code: "VI", name: "Virgin Islands (U.S.)" },
  { code: "VN", name: "Viet Nam" },
  { code: "VU", name: "Vanuatu" },
  { code: "WF", name: "Wallis and Futuna" },
  { code: "WS", name: "Samoa" },
  { code: "YE", name: "Yemen" },
  { code: "YT", name: "Mayotte" },
  { code: "ZA", name: "South Africa" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" }
];
var SUBDIVISION_CODES = Object.keys(DEFAULT_STRINGS.subdivisions);
var ENGLISH_COUNTRY_NAMES = new Map(COUNTRIES.map((c) => [c.code, c.name]));
function validLocale(locale) {
  if (!locale) return void 0;
  try {
    return Intl.getCanonicalLocales(locale)[0];
  } catch {
    return void 0;
  }
}
function countryNamer(locale) {
  const english = (code) => ENGLISH_COUNTRY_NAMES.get(code) ?? code;
  if (!locale || locale.split("-")[0] === "en" || typeof Intl.DisplayNames !== "function") return english;
  const names = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
  return (code) => names.of(code) ?? english(code);
}
function localizeJurisdictions(strings, locale) {
  const tag = validLocale(locale);
  const country = countryNamer(tag);
  const options = [
    ...COUNTRIES.map((c) => ({ code: c.code, name: country(c.code) })),
    ...SUBDIVISION_CODES.map((code) => ({
      code,
      name: format(strings.jurisdiction.subdivisionName, {
        country: country(code.slice(0, 2)),
        subdivision: strings.subdivisions[code] ?? DEFAULT_STRINGS.subdivisions[code] ?? code
      })
    }))
  ];
  const collator = new Intl.Collator(tag);
  return options.sort((a, b) => collator.compare(a.name, b.name));
}
var JURISDICTIONS = localizeJurisdictions(DEFAULT_STRINGS);

// ../core-sdk-js/src/declare-retry.ts
var MAX_DECLARE_ATTEMPTS = 4;
var BASE_DELAY_MS = 250;
var MAX_DELAY_MS = 2e3;
var RETRYABLE_CODES = /* @__PURE__ */ new Set(["unavailable", "rate_limited"]);
function isRetryableDeclareError(error) {
  return error instanceof KidError && RETRYABLE_CODES.has(error.code);
}
function declareRetryDelayMs(attempt) {
  return Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
}
function isLiveKey(publishableKey) {
  return publishableKey.startsWith("kgp_live_");
}

// ../core-sdk-js/src/browser/deviceKey.ts
async function generateKey() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const { kty, crv, x, y } = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { privateKey: pair.privateKey, publicJwk: { kty, crv, x, y } };
}
function isStoredKey(value) {
  const key = value;
  return key?.privateKey instanceof CryptoKey && key.privateKey.type === "private" && key.privateKey.algorithm.name === "ECDSA" && typeof key.publicJwk?.x === "string" && typeof key.publicJwk.y === "string";
}
var DB_NAME = "k-id-core";
var DB_STORE = "device-keys";
var DB_KEY = "dpop";
function settled(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function keyStoreFactory() {
  try {
    return globalThis.indexedDB ?? void 0;
  } catch {
    return void 0;
  }
}
function openKeyStore(factory) {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function readStoredKey(db) {
  return settled(db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(DB_KEY));
}
async function loadKey() {
  const factory = keyStoreFactory();
  if (!factory) return generateKey();
  let db;
  let stored;
  try {
    db = await openKeyStore(factory);
    stored = await readStoredKey(db);
  } catch {
    db?.close();
    return generateKey();
  }
  try {
    if (isStoredKey(stored)) return stored;
    const fresh = await generateKey();
    try {
      const keys = db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE);
      await settled(stored === void 0 ? keys.add(fresh, DB_KEY) : keys.put(fresh, DB_KEY));
      return fresh;
    } catch {
      const winner = await readStoredKey(db).catch(() => void 0);
      return isStoredKey(winner) ? winner : fresh;
    }
  } finally {
    db.close();
  }
}
function createWebCryptoKeyProvider() {
  let shared = null;
  return {
    getKey() {
      shared ??= (async () => {
        const { privateKey, publicJwk } = await loadKey();
        return {
          publicJwk,
          async sign(data) {
            return new Uint8Array(
              await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, data)
            );
          }
        };
      })().catch((err) => {
        shared = null;
        throw err;
      });
      return shared;
    }
  };
}
var webCryptoKeyProvider = createWebCryptoKeyProvider();

// ../core-sdk-js/src/browser/page.ts
function pageBaseURI() {
  return typeof document === "undefined" ? void 0 : document.baseURI;
}

// ../core-sdk-js/src/browser/recaptcha.ts
var RECAPTCHA_SCRIPT = "https://www.google.com/recaptcha/enterprise.js?render=";
var CHECK_TIMEOUT_MS = 3e4;
var vendorGlobals = globalThis;
var scripts = /* @__PURE__ */ new Map();
function loadScript(src) {
  const cached = scripts.get(src);
  if (cached) return cached;
  const element = document.createElement("script");
  element.src = src;
  element.async = true;
  const load = {
    element,
    loaded: false,
    done: new Promise((resolve, reject) => {
      element.onload = () => {
        load.loaded = true;
        resolve();
      };
      element.onerror = () => {
        forgetScript(src, load);
        reject(new Error(`Could not load ${src}`));
      };
    })
  };
  scripts.set(src, load);
  document.head.appendChild(element);
  return load;
}
function forgetScript(src, load) {
  if (scripts.get(src) === load) scripts.delete(src);
  load.element.remove();
}
function withTimeout(work) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Bot check timed out")), CHECK_TIMEOUT_MS);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
async function recaptchaToken(hint) {
  const src = RECAPTCHA_SCRIPT + encodeURIComponent(hint.siteKey);
  const script = loadScript(src);
  let abandoned = false;
  try {
    return await withTimeout(
      script.done.then(() => {
        if (abandoned) throw new Error("Bot check abandoned");
        const enterprise = vendorGlobals.grecaptcha?.enterprise;
        if (!enterprise) throw new Error("reCAPTCHA Enterprise did not load");
        return new Promise((resolve, reject) => {
          enterprise.ready(() => {
            enterprise.execute(hint.siteKey, { action: hint.action ?? "" }).then(resolve, reject);
          });
        });
      })
    );
  } catch (err) {
    if (!script.loaded) forgetScript(src, script);
    throw err;
  } finally {
    abandoned = true;
  }
}
var scriptBotCheck = {
  async token(hint) {
    if (typeof document === "undefined") throw new Error("A bot check needs a page");
    return recaptchaToken(hint);
  }
};

// ../core-sdk-js/src/react/context.ts
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
var KidCoreContext = createContext(null);
function useKidCoreContext() {
  const ctx = useContext(KidCoreContext);
  if (!ctx) throw new Error("Wrap your app in <KidCoreProvider> before using k-ID hooks or components.");
  return ctx;
}
function useKidStrings() {
  return useKidCoreContext().strings;
}
function useKidJurisdictions() {
  const { strings, locale } = useKidCoreContext();
  return useMemo(() => localizeJurisdictions(strings, locale), [strings, locale]);
}
var KidSessionContext = createContext(null);
function useAgeGateController() {
  const ctx = useContext(KidSessionContext);
  if (!ctx) throw new Error("Wrap the flow in <KidSessionProvider> before using k-ID hooks or components.");
  return ctx.controller;
}
function useAgeGateState() {
  const controller = useAgeGateController();
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}
var KidSettingsContext = createContext(null);
function useSettingsController() {
  const ctx = useContext(KidSettingsContext);
  if (!ctx) throw new Error("Wrap the settings surface in <KidSettingsProvider> before using its hooks or components.");
  return ctx.controller;
}
function useSettingsState() {
  const controller = useSettingsController();
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}

// ../core-sdk-js/src/react/hooks.ts
import { useSyncExternalStore as useSyncExternalStore2 } from "react";
function useKidAgeGate() {
  const controller = useAgeGateController();
  const state = useAgeGateState();
  return {
    status: state.status,
    challengeId: state.challengeId,
    challengeKind: state.challengeKind,
    sessionId: state.sessionId,
    error: state.error,
    requirements: state.requirements,
    submit: controller.submit
  };
}
var BEFORE_SESSION = {
  status: "running",
  step: null,
  challengeId: null,
  rawChallengeStatus: null,
  expiresAt: null,
  error: null
};
var noSubscription = () => () => {
};
function useSessionVerifyAgeController() {
  useAgeGateState();
  return useAgeGateController().sessionVerifyAge();
}
function useSessionVerifyAge() {
  const controller = useSessionVerifyAgeController();
  const getState = () => controller?.getState() ?? BEFORE_SESSION;
  const state = useSyncExternalStore2(controller?.subscribe ?? noSubscription, getState, getState);
  return {
    ...state,
    start: () => controller?.start(),
    submit: (email) => {
      if (!controller) return Promise.resolve({ ok: false, error: localKidError("invalid_request") });
      controller.setEmail(email);
      return controller.submit();
    }
  };
}
function useKidSession() {
  const controller = useAgeGateController();
  const state = useAgeGateState();
  const verifyAge = useSessionVerifyAge();
  const permissions = {};
  for (const p of state.session?.permissions ?? []) permissions[p.name] = p.enabled;
  return {
    session: state.session,
    permissions,
    sessionId: state.sessionId,
    isLoaded: state.session !== null,
    ageVerification: state.session?.ageVerification ?? null,
    verifyAge,
    refresh: controller.refreshSession
  };
}
function useKidPermission() {
  const state = useAgeGateState();
  const byName = new Map((state.session?.permissions ?? []).map((p) => [p.name, p]));
  return {
    can: (name) => byName.get(name)?.enabled ?? false,
    get: (name) => byName.get(name) ?? null
  };
}
function useKidPermissionSettings() {
  const controller = useSettingsController();
  const state = useSettingsState();
  return {
    permissions: state.session?.permissions ?? [],
    isLoaded: state.isLoaded,
    error: state.error,
    change: controller.change,
    hasApproverEmail: state.session?.hasApproverEmail !== false,
    upgrade: controller.upgrade,
    challenge: state.challenge,
    refresh: controller.refresh
  };
}
function useKidChallenge() {
  const state = useAgeGateState();
  return {
    challengeId: state.challengeId,
    status: state.rawChallengeStatus,
    expiresAt: state.expiresAt
  };
}

// ../core-sdk-js/src/react/slots.ts
import { Children, isValidElement } from "react";
function collectSlots(children, types) {
  const slots = {};
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    for (const [status, type] of Object.entries(types)) {
      if (child.type === type) slots[status] = child;
    }
  });
  return slots;
}

// ../core-sdk-js/src/react/sessionProvider.tsx
import { useEffect, useMemo as useMemo2, useRef, useSyncExternalStore as useSyncExternalStore3 } from "react";
import { jsx } from "react/jsx-runtime";
function KidSessionProvider({
  jurisdiction,
  age,
  email,
  challengeId,
  sessionId,
  onChallenge,
  onSession,
  onClaim,
  children
}) {
  const { client, sessions, declarationStatus, declarationError } = useKidCoreContext();
  const controllerRef = useRef(null);
  if (!controllerRef.current) {
    controllerRef.current = createAgeGateController({
      client,
      sessions,
      initial: { jurisdiction, age, email, challengeId, sessionId }
    });
  }
  const controller = controllerRef.current;
  useEffect(() => {
    if (declarationStatus === "error") {
      controller.declarationFailed(declarationError);
      return;
    }
    if (declarationStatus !== "ready") return;
    controller.start();
    return () => controller.destroy();
  }, [controller, declarationStatus, declarationError]);
  const ageKey = JSON.stringify(age ?? null);
  useEffect(() => {
    controller.configure({ jurisdiction, age, email });
  }, [controller, jurisdiction, ageKey, email]);
  const outChallengeId = useSyncExternalStore3(
    controller.subscribe,
    () => resumableChallengeId(controller.getState()),
    () => resumableChallengeId(controller.getState())
  );
  const outSessionId = useSyncExternalStore3(
    controller.subscribe,
    () => controller.getState().sessionId,
    () => controller.getState().sessionId
  );
  const firedChallenge = useRef(null);
  useEffect(() => {
    if (outChallengeId && outChallengeId !== firedChallenge.current) {
      firedChallenge.current = outChallengeId;
      onChallenge?.(outChallengeId);
    }
  }, [outChallengeId, onChallenge]);
  const firedSession = useRef(null);
  useEffect(() => {
    if (outSessionId && outSessionId !== firedSession.current) {
      firedSession.current = outSessionId;
      onSession?.(outSessionId);
    }
  }, [outSessionId, onSession]);
  const outClaimToken = useSyncExternalStore3(
    controller.subscribe,
    () => controller.getState().claimToken,
    () => controller.getState().claimToken
  );
  const firedClaim = useRef(null);
  useEffect(() => {
    if (outClaimToken && outClaimToken !== firedClaim.current) {
      firedClaim.current = outClaimToken;
      onClaim?.(outClaimToken);
    }
  }, [outClaimToken, onClaim]);
  const value = useMemo2(() => ({ controller }), [controller]);
  return /* @__PURE__ */ jsx(KidSessionContext.Provider, { value, children });
}

// ../core-sdk-js/src/react/settingsProvider.tsx
import { useEffect as useEffect2, useMemo as useMemo3, useRef as useRef2 } from "react";
import { jsx as jsx2 } from "react/jsx-runtime";
function KidSettingsProvider({ sessionId, challengeId, onChallenge, children }) {
  const { client, sessions, asks } = useKidCoreContext();
  const onChallengeRef = useRef2(onChallenge);
  onChallengeRef.current = onChallenge;
  const controllerRef = useRef2(null);
  if (!controllerRef.current) {
    controllerRef.current = createSettingsController({
      client,
      sessions,
      asks,
      initial: { sessionId, challengeId },
      onChallenge: (id) => onChallengeRef.current?.(id)
    });
  }
  const controller = controllerRef.current;
  useEffect2(() => {
    controller.start();
    return () => controller.destroy();
  }, [controller]);
  const value = useMemo3(() => ({ controller }), [controller]);
  return /* @__PURE__ */ jsx2(KidSettingsContext.Provider, { value, children });
}

// src/react/styles.ts
var STYLESHEET = `@layer kid{
.kid-card{display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box;padding:20px;color:var(--kid-color-text);background:var(--kid-color-surface);border:1px solid var(--kid-color-border);border-radius:var(--kid-radius);font-family:var(--kid-font-family);accent-color:var(--kid-color-primary)}
.kid-title{font-size:16px;font-weight:600;margin:0}
.kid-label{font-size:14px;font-weight:600}
.kid-input{padding:10px 12px;border:1px solid var(--kid-color-border);border-radius:calc(var(--kid-radius) / 2);font:inherit}
.kid-button{padding:10px 14px;border:none;border-radius:calc(var(--kid-radius) / 2);background:var(--kid-color-primary);color:var(--kid-color-on-primary);font:inherit;font-weight:600;cursor:pointer}
.kid-muted{color:var(--kid-color-text-muted);font-size:14px;margin:0}
.kid-danger{color:var(--kid-color-danger);font-size:14px;margin:0}
.kid-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.kid-askForm{display:flex;flex-direction:column;gap:12px}
.kid-controlColumn{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.kid-pill{padding:4px 12px;border-radius:999px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.kid-pillAsk{border:1px solid var(--kid-color-border);background:transparent;color:var(--kid-color-text)}
.kid-pillAdded{border:1px solid var(--kid-color-primary);background:var(--kid-color-primary);color:var(--kid-color-on-primary)}
}`;
var STYLE_ID = "kid-core-styles";
var injected = false;
function injectStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLESHEET;
  document.head.prepend(style);
}
function elementProps(appearance, ...keys) {
  const classes = [];
  let style;
  for (const key of keys) {
    classes.push(`kid-${key}`);
    const override = appearance?.elements?.[key];
    if (typeof override === "string") classes.push(override);
    else if (override) style = { ...style, ...override };
  }
  return style ? { className: classes.join(" "), style } : { className: classes.join(" ") };
}
function useEl() {
  const { appearance, dir } = useKidCoreContext();
  return (...keys) => dir ? { ...elementProps(appearance, ...keys), dir } : elementProps(appearance, ...keys);
}

// src/react/theme.ts
var DEFAULT_VARIABLES = {
  colorPrimary: "#4f46e5",
  colorOnPrimary: "#ffffff",
  colorText: "#111827",
  colorTextMuted: "#6b7280",
  colorSurface: "#ffffff",
  colorSurfaceMuted: "#f3f4f6",
  colorBorder: "#e5e7eb",
  colorDanger: "#dc2626",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  radius: "12px"
};
var VAR_NAMES = {
  colorPrimary: "--kid-color-primary",
  colorOnPrimary: "--kid-color-on-primary",
  colorText: "--kid-color-text",
  colorTextMuted: "--kid-color-text-muted",
  colorSurface: "--kid-color-surface",
  colorSurfaceMuted: "--kid-color-surface-muted",
  colorBorder: "--kid-color-border",
  colorDanger: "--kid-color-danger",
  fontFamily: "--kid-font-family",
  radius: "--kid-radius"
};
function appearanceToCssVars(appearance) {
  const merged = { ...DEFAULT_VARIABLES, ...appearance?.variables };
  const vars = {};
  for (const key of Object.keys(VAR_NAMES)) {
    vars[VAR_NAMES[key]] = String(merged[key]);
  }
  return vars;
}

// src/react/provider.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function KidCoreProvider({
  publishableKey,
  baseUrl,
  appearance,
  localization,
  declare,
  children
}) {
  const strings = useMemo4(() => mergeStrings(localization), [localization]);
  const locale = localization?.locale;
  const dir = textDirection(locale);
  useEffect3(() => injectStyles(), []);
  const clientRef = useRef3(null);
  if (!clientRef.current)
    clientRef.current = createClient({
      publishableKey,
      baseUrl,
      deviceKeys: webCryptoKeyProvider,
      botCheck: scriptBotCheck,
      baseURI: pageBaseURI
    });
  const client = clientRef.current;
  const sessionsRef = useRef3(null);
  if (!sessionsRef.current) sessionsRef.current = createSessionStore();
  const sessions = sessionsRef.current;
  const asksRef = useRef3(null);
  if (!asksRef.current) asksRef.current = createAskWatcher({ client, sessions });
  const asks = asksRef.current;
  useEffect3(() => {
    asks.start();
    return () => asks.stop();
  }, [asks]);
  const declared = isLiveKey(publishableKey) ? void 0 : declare;
  const [declarationStatus, setDeclarationStatus] = useState(declared ? "pending" : "ready");
  const [declarationError, setDeclarationError] = useState();
  const started = useRef3(false);
  useEffect3(() => {
    if (!declared || started.current) return;
    started.current = true;
    void (async () => {
      for (let attempt = 1; ; attempt++) {
        try {
          await client.declare(declared);
          setDeclarationStatus("ready");
          return;
        } catch (e) {
          if (attempt >= MAX_DECLARE_ATTEMPTS || !isRetryableDeclareError(e)) {
            console.error("[k-ID] declare failed", e);
            setDeclarationError(e);
            setDeclarationStatus("error");
            return;
          }
          await sleep(declareRetryDelayMs(attempt));
        }
      }
    })();
  }, [client, declared]);
  const value = useMemo4(
    () => ({ client, sessions, asks, appearance, strings, locale, dir, declarationStatus, declarationError }),
    [client, sessions, asks, appearance, strings, locale, dir, declarationStatus, declarationError]
  );
  return /* @__PURE__ */ jsx3(KidCoreContext.Provider, { value, children: /* @__PURE__ */ jsx3("div", { style: { display: "contents", ...appearanceToCssVars(appearance) }, children }) });
}

// src/react/components.tsx
import { useEffect as useEffect4, useState as useState2, useSyncExternalStore as useSyncExternalStore4 } from "react";
import { Fragment, jsx as jsx4, jsxs } from "react/jsx-runtime";
var DEFAULT_AGE_METHOD_PREFERENCE = ["age-slider", "date-of-birth"];
function isWebAgeMethod(method) {
  return method === "date-of-birth" || method === "age-slider";
}
function KidSelectJurisdiction({ onSelect } = {}) {
  const controller = useAgeGateController();
  const state = useAgeGateState();
  const t = useKidStrings().jurisdiction;
  const jurisdictions = useKidJurisdictions();
  const el = useEl();
  const [code, setCode] = useState2("");
  if (state.step !== "jurisdiction") return null;
  function submit(e) {
    e.preventDefault();
    if (!code) return;
    controller.setJurisdiction(code);
    onSelect?.(code);
  }
  return /* @__PURE__ */ jsxs("form", { ...el("card", "selectJurisdiction"), onSubmit: submit, children: [
    /* @__PURE__ */ jsx4("label", { ...el("label"), htmlFor: "kid-jurisdiction", children: t.label }),
    /* @__PURE__ */ jsxs("select", { ...el("input"), id: "kid-jurisdiction", value: code, onChange: (e) => setCode(e.target.value), required: true, children: [
      /* @__PURE__ */ jsx4("option", { value: "", disabled: true, children: t.placeholder }),
      jurisdictions.map((j) => /* @__PURE__ */ jsx4("option", { value: j.code, children: j.name }, j.code))
    ] }),
    /* @__PURE__ */ jsx4("button", { ...el("button"), type: "submit", disabled: !code, children: t.submit })
  ] });
}
var MAX_SLIDER_AGE = 35;
function KidCollectAge({
  methods,
  onSubmit
} = {}) {
  const controller = useAgeGateController();
  const state = useAgeGateState();
  const t = useKidStrings().age;
  const el = useEl();
  const [dob, setDob] = useState2("");
  const [age, setAge] = useState2();
  if (state.step !== "age") return null;
  const approved = state.requirements?.approvedAgeCollectionMethods?.filter(isWebAgeMethod);
  if (!approved) return null;
  const preferred = (methods ?? DEFAULT_AGE_METHOD_PREFERENCE).filter((m) => approved.includes(m));
  const method = preferred[0] ?? approved[0];
  if (!method) return null;
  function submit(e) {
    e.preventDefault();
    let signal;
    if (method === "date-of-birth") signal = { dateOfBirth: dob };
    else if (age !== void 0) signal = { age };
    else return;
    controller.setAge(signal);
    onSubmit?.(signal);
  }
  return /* @__PURE__ */ jsx4("form", { ...el("card", "collectAge"), onSubmit: submit, children: method === "date-of-birth" ? /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx4("label", { ...el("label"), htmlFor: "kid-dob", children: t.dateOfBirthLabel }),
    /* @__PURE__ */ jsx4(
      "input",
      {
        ...el("input"),
        id: "kid-dob",
        type: "date",
        value: dob,
        onChange: (e) => setDob(e.target.value),
        required: true
      }
    ),
    /* @__PURE__ */ jsx4("button", { ...el("button"), type: "submit", disabled: !dob, children: t.submit })
  ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx4("label", { ...el("label"), htmlFor: "kid-age", children: format(t.ageLabel, { age: age === void 0 ? "-" : age === MAX_SLIDER_AGE ? `${age}+` : age }) }),
    /* @__PURE__ */ jsx4(
      "input",
      {
        ...el("input"),
        id: "kid-age",
        type: "range",
        min: 1,
        max: MAX_SLIDER_AGE,
        value: age ?? 1,
        onChange: (e) => setAge(Number(e.target.value)),
        onPointerUp: (e) => setAge(Number(e.currentTarget.value))
      }
    ),
    /* @__PURE__ */ jsx4("button", { ...el("button"), type: "submit", disabled: age === void 0, children: t.submit })
  ] }) });
}
function ChallengeEmailForm({
  strings: t,
  id,
  name,
  setEmail: commitEmail,
  submit: send,
  onSent
}) {
  const el = useEl();
  const [email, setEmail] = useState2("");
  const [busy, setBusy] = useState2(false);
  const [error, setError] = useState2(null);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    commitEmail(email);
    try {
      const res = await send();
      if (res.ok) onSent?.({ email });
      else setError(res.error?.code === "invalid_request" ? t.invalidEmail : t.error);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("form", { ...el("card", name), onSubmit: submit, children: [
    /* @__PURE__ */ jsx4("label", { ...el("label"), htmlFor: id, children: t.title }),
    /* @__PURE__ */ jsx4("p", { ...el("muted"), children: t.description }),
    /* @__PURE__ */ jsx4(
      "input",
      {
        ...el("input"),
        id,
        type: "email",
        autoComplete: "email",
        placeholder: t.emailPlaceholder,
        value: email,
        onChange: (e) => setEmail(e.target.value),
        required: true
      }
    ),
    /* @__PURE__ */ jsx4("button", { ...el("button"), type: "submit", disabled: busy || !email, children: busy ? t.submitting : t.submit }),
    error ? /* @__PURE__ */ jsx4("p", { role: "alert", ...el("danger"), children: error }) : null
  ] });
}
function GateEmailForm({
  step,
  strings,
  id,
  name,
  onSent
}) {
  const controller = useAgeGateController();
  const state = useAgeGateState();
  if (state.step !== step || state.emailProvided) return null;
  return /* @__PURE__ */ jsx4(
    ChallengeEmailForm,
    {
      strings,
      id,
      name,
      setEmail: controller.setEmail,
      submit: controller.submit,
      onSent
    }
  );
}
function KidAskAnAdult({ onSent } = {}) {
  const t = useKidStrings().askAnAdult;
  return /* @__PURE__ */ jsx4(GateEmailForm, { step: "parentalConsent", strings: t, id: "kid-adult-email", name: "askAnAdult", onSent });
}
function KidVerifyAge({ onSent } = {}) {
  const t = useKidStrings().verifyAge;
  return /* @__PURE__ */ jsx4(GateEmailForm, { step: "ageAssurance", strings: t, id: "kid-verify-email", name: "verifyAge", onSent });
}
function KidSessionVerifyAgePending({ children }) {
  return /* @__PURE__ */ jsx4(Fragment, { children });
}
function KidSessionVerifyAgeFail({ children }) {
  return /* @__PURE__ */ jsx4(Fragment, { children });
}
function KidSessionVerifyAgePass({ children }) {
  return /* @__PURE__ */ jsx4(Fragment, { children });
}
function KidSessionVerifyAgeError({ children }) {
  return /* @__PURE__ */ jsx4(Fragment, { children });
}
function KidSessionVerifyAge({
  onSent,
  children
}) {
  const t = useKidStrings().verifyAge;
  const controller = useSessionVerifyAgeController();
  const getState = () => controller?.getState() ?? null;
  const state = useSyncExternalStore4(controller?.subscribe ?? (() => () => {
  }), getState, getState);
  const slots = collectSlots(children, {
    pending: KidSessionVerifyAgePending,
    fail: KidSessionVerifyAgeFail,
    pass: KidSessionVerifyAgePass,
    error: KidSessionVerifyAgeError
  });
  useEffect4(() => {
    controller?.start();
  }, [controller]);
  if (!controller || !state) return null;
  if (state.status !== "running") return /* @__PURE__ */ jsx4(Fragment, { children: slots[state.status] ?? null });
  if (state.step !== "email") return null;
  return /* @__PURE__ */ jsx4(
    ChallengeEmailForm,
    {
      strings: t,
      id: "kid-session-verify-email",
      name: "verifyAge",
      setEmail: controller.setEmail,
      submit: controller.submit,
      onSent
    }
  );
}
function KidPermission({
  name,
  fallback = null,
  children
}) {
  const { can } = useKidPermission();
  return /* @__PURE__ */ jsx4(Fragment, { children: can(name) ? children : fallback });
}

// src/react/AgeGate.tsx
import { Fragment as Fragment2, jsx as jsx5, jsxs as jsxs2 } from "react/jsx-runtime";
function KidAgeGatePending({ children }) {
  return /* @__PURE__ */ jsx5(Fragment2, { children });
}
function KidAgeGateProhibited({ children }) {
  return /* @__PURE__ */ jsx5(Fragment2, { children });
}
function KidAgeGateFail({ children }) {
  return /* @__PURE__ */ jsx5(Fragment2, { children });
}
function KidAgeGatePass({ children }) {
  return /* @__PURE__ */ jsx5(Fragment2, { children });
}
function KidAgeGateError({ children }) {
  return /* @__PURE__ */ jsx5(Fragment2, { children });
}
var Capture = () => /* @__PURE__ */ jsxs2(Fragment2, { children: [
  /* @__PURE__ */ jsx5(KidSelectJurisdiction, {}),
  /* @__PURE__ */ jsx5(KidCollectAge, {}),
  /* @__PURE__ */ jsx5(KidAskAnAdult, {}),
  /* @__PURE__ */ jsx5(KidVerifyAge, {})
] });
function KidAgeGate({ children }) {
  const { status } = useAgeGateState();
  const slots = collectSlots(children, {
    pending: KidAgeGatePending,
    prohibited: KidAgeGateProhibited,
    fail: KidAgeGateFail,
    pass: KidAgeGatePass,
    error: KidAgeGateError
  });
  switch (status) {
    case "running":
      return /* @__PURE__ */ jsx5(Capture, {});
    case "pending":
      return /* @__PURE__ */ jsx5(Fragment2, { children: slots.pending ?? null });
    case "prohibited":
      return /* @__PURE__ */ jsx5(Fragment2, { children: slots.prohibited ?? null });
    case "fail":
      return /* @__PURE__ */ jsx5(Fragment2, { children: slots.fail ?? null });
    case "pass":
      return /* @__PURE__ */ jsx5(Fragment2, { children: slots.pass ?? null });
    case "error":
      return /* @__PURE__ */ jsx5(Fragment2, { children: slots.error ?? null });
  }
}

// src/react/settings.tsx
import { useEffect as useEffect5, useRef as useRef4, useState as useState3 } from "react";
import { Fragment as Fragment3, jsx as jsx6, jsxs as jsxs3 } from "react/jsx-runtime";
function usePermissionName(name) {
  return useKidStrings().permissions[name]?.name ?? name;
}
function verifyAgeStep(res, sentEmail) {
  if (res.ok) return { step: "verify" };
  const code = res.error?.code ?? "unavailable";
  if (!sentEmail && code === "invalid_request") return { step: "email" };
  return { step: "verify", failed: code };
}
function PlayerRow({ permission }) {
  const t = useKidStrings().settings;
  const el = useEl();
  const { change } = useKidPermissionSettings();
  const [busy, setBusy] = useState3(false);
  const [failed, setFailed] = useState3(false);
  const name = format(t.enabledLabel, { permission: usePermissionName(permission.name) });
  async function toggle(enabled) {
    setBusy(true);
    setFailed(false);
    try {
      const res = await change(permission.name, enabled);
      if (!res.ok) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs3("div", { ...el("row"), children: [
    /* @__PURE__ */ jsx6("span", { ...el("label"), children: name }),
    /* @__PURE__ */ jsxs3("span", { ...el("controlColumn"), children: [
      /* @__PURE__ */ jsxs3("label", { ...el("muted"), children: [
        /* @__PURE__ */ jsx6(
          "input",
          {
            type: "checkbox",
            "aria-label": name,
            checked: permission.enabled,
            disabled: busy,
            onChange: (e) => void toggle(e.target.checked)
          }
        ),
        " ",
        permission.enabled ? t.on : t.off
      ] }),
      failed ? /* @__PURE__ */ jsx6("span", { role: "alert", ...el("danger"), children: t.error }) : null
    ] })
  ] });
}
function VerifyAgeRow({ permission, disabled }) {
  const strings = useKidStrings();
  const t = strings.settings;
  const el = useEl();
  const { upgrade, challenge } = useKidPermissionSettings();
  const [step, setStep] = useState3("verify");
  const [failedCode, setFailedCode] = useState3();
  const email = useRef4("");
  const name = format(t.enabledLabel, { permission: usePermissionName(permission.name) });
  const mine = challenge.challengeKind === "ageAssurance" && challenge.permissions.includes(permission.name);
  async function request(playerEmail) {
    setStep("sending");
    setFailedCode(void 0);
    const res = await upgrade([permission.name], playerEmail);
    const next = verifyAgeStep(res, playerEmail !== void 0);
    setStep(next.step);
    setFailedCode(next.failed);
    return res;
  }
  if (step === "sending")
    return /* @__PURE__ */ jsxs3("div", { ...el("row"), children: [
      /* @__PURE__ */ jsx6("span", { ...el("label"), children: name }),
      /* @__PURE__ */ jsx6("span", { ...el("muted"), children: strings.verifyAge.submitting })
    ] });
  if (mine && challenge.status === "pending")
    return /* @__PURE__ */ jsxs3("div", { ...el("row"), children: [
      /* @__PURE__ */ jsx6("span", { ...el("label"), children: name }),
      /* @__PURE__ */ jsx6("span", { ...el("muted"), children: t.verifying })
    ] });
  if (step === "email")
    return /* @__PURE__ */ jsx6(
      ChallengeEmailForm,
      {
        strings: strings.verifyAge,
        id: `kid-settings-verify-${permission.name}`,
        name: "verifyAge",
        setEmail: (value) => email.current = value,
        submit: () => request(email.current)
      }
    );
  return /* @__PURE__ */ jsxs3("div", { ...el("row"), children: [
    /* @__PURE__ */ jsx6("span", { ...el("label"), children: name }),
    /* @__PURE__ */ jsxs3("span", { ...el("controlColumn"), children: [
      /* @__PURE__ */ jsx6(
        "button",
        {
          ...el("pill", "pillAsk"),
          type: "button",
          "aria-label": `${strings.verifyAge.title} ${name}`,
          disabled,
          onClick: () => void request(),
          children: strings.verifyAge.title
        }
      ),
      failedCode ? /* @__PURE__ */ jsx6("span", { role: "alert", ...el("danger"), children: failedCode === "invalid_request" ? strings.verifyAge.invalidEmail : strings.verifyAge.error }) : null
    ] })
  ] });
}
function GuardianRow({
  permission,
  added,
  disabled,
  onToggle
}) {
  const t = useKidStrings().settings;
  const el = useEl();
  const name = format(t.enabledLabel, { permission: usePermissionName(permission.name) });
  return /* @__PURE__ */ jsxs3("div", { ...el("row"), children: [
    /* @__PURE__ */ jsx6("span", { ...el("label"), children: name }),
    permission.enabled ? /* @__PURE__ */ jsx6("span", { ...el("muted"), children: t.granted }) : /* @__PURE__ */ jsx6(
      "button",
      {
        ...el("pill", added ? "pillAdded" : "pillAsk"),
        type: "button",
        "aria-label": `${added ? t.added : t.ask} ${name}`,
        disabled,
        onClick: onToggle,
        children: added ? t.added : t.ask
      }
    )
  ] });
}
function KidPermissionSettings() {
  const strings = useKidStrings();
  const t = strings.settings;
  const el = useEl();
  const { permissions, isLoaded, error, hasApproverEmail, upgrade, challenge } = useKidPermissionSettings();
  const [staged, setStaged] = useState3([]);
  const [approverEmail, setApproverEmail] = useState3("");
  const [failedCode, setFailedCode] = useState3();
  const [asking, setAsking] = useState3(false);
  const [askFailed, setAskFailed] = useState3(false);
  useEffect5(() => {
    if (challenge.status === "error" && challenge.challengeKind === "parentalConsent")
      setStaged((s) => s.length > 0 ? s : challenge.permissions);
  }, [challenge.status, challenge.challengeKind, challenge.permissions]);
  useEffect5(() => {
    if (challenge.status !== "error") setAskFailed(false);
  }, [challenge.status]);
  if (error && !isLoaded)
    return /* @__PURE__ */ jsx6("p", { role: "alert", ...el("danger"), children: t.error });
  if (!isLoaded) return null;
  const inFlight = challenge.status === "sending" || challenge.status === "pending";
  const isAdded = (name) => inFlight ? challenge.permissions.includes(name) : staged.includes(name);
  const toggle = (name) => setStaged((s) => s.includes(name) ? s.filter((n) => n !== name) : [...s, name]);
  const needsEmail = !hasApproverEmail && !inFlight;
  async function ask(e) {
    e.preventDefault();
    if (staged.length === 0) return;
    const names = staged;
    setStaged([]);
    setAsking(true);
    const res = await upgrade(names, hasApproverEmail ? void 0 : approverEmail);
    setAsking(false);
    setFailedCode(res.ok ? void 0 : res.error?.code);
    if (!res.ok) {
      setStaged(names);
      setAskFailed(true);
    }
  }
  const waiting = challenge.status === "pending" && challenge.challengeKind !== "ageAssurance";
  const grownupFailed = askFailed || challenge.status === "error" && challenge.challengeKind === "parentalConsent";
  const ctaLabel = asking ? t.asking : waiting ? t.waiting : t.askGrownup;
  return /* @__PURE__ */ jsxs3(Fragment3, { children: [
    permissions.filter((p) => p.managedBy !== "PROHIBITED").map(
      (p) => p.managedBy === "GUARDIAN" ? /* @__PURE__ */ jsx6(
        GuardianRow,
        {
          permission: p,
          added: isAdded(p.name),
          disabled: inFlight,
          onToggle: () => toggle(p.name)
        },
        p.name
      ) : p.verifiedAgeThreshold !== void 0 && !p.enabled ? /* @__PURE__ */ jsx6(VerifyAgeRow, { permission: p, disabled: inFlight || staged.length > 0 }, p.name) : /* @__PURE__ */ jsx6(PlayerRow, { permission: p }, p.name)
    ),
    staged.length > 0 || asking || waiting ? /* @__PURE__ */ jsxs3("form", { ...el("askForm"), onSubmit: (e) => void ask(e), children: [
      needsEmail ? /* @__PURE__ */ jsxs3(Fragment3, { children: [
        /* @__PURE__ */ jsx6("label", { ...el("label"), htmlFor: "kid-settings-approver-email", children: strings.askAnAdult.title }),
        /* @__PURE__ */ jsx6("p", { ...el("muted"), children: strings.askAnAdult.description }),
        /* @__PURE__ */ jsx6(
          "input",
          {
            ...el("input"),
            id: "kid-settings-approver-email",
            type: "email",
            autoComplete: "email",
            placeholder: strings.askAnAdult.emailPlaceholder,
            value: approverEmail,
            onChange: (e) => setApproverEmail(e.target.value),
            required: true
          }
        )
      ] }) : null,
      /* @__PURE__ */ jsx6("button", { ...el("button"), type: "submit", disabled: inFlight || needsEmail && !approverEmail, children: ctaLabel })
    ] }) : null,
    grownupFailed ? /* @__PURE__ */ jsx6("p", { role: "alert", ...el("danger"), children: hasApproverEmail ? t.error : failedCode === "invalid_request" ? strings.askAnAdult.invalidEmail : strings.askAnAdult.error }) : null
  ] });
}
function KidSettings() {
  const t = useKidStrings().settings;
  const el = useEl();
  return /* @__PURE__ */ jsxs3("section", { ...el("card", "settings"), children: [
    /* @__PURE__ */ jsx6("h2", { ...el("title"), children: t.title }),
    /* @__PURE__ */ jsx6(KidPermissionSettings, {})
  ] });
}

// src/version.ts
var SDK_VERSION = "1.0.0";
export {
  DEFAULT_STRINGS,
  JURISDICTIONS,
  KidAgeGate,
  KidAgeGateError,
  KidAgeGateFail,
  KidAgeGatePass,
  KidAgeGatePending,
  KidAgeGateProhibited,
  KidAskAnAdult,
  KidCollectAge,
  KidCoreProvider,
  KidError,
  KidPermission,
  KidPermissionSettings,
  KidSelectJurisdiction,
  KidSessionProvider,
  KidSessionVerifyAge,
  KidSessionVerifyAgeError,
  KidSessionVerifyAgeFail,
  KidSessionVerifyAgePass,
  KidSessionVerifyAgePending,
  KidSettings,
  KidSettingsProvider,
  KidVerifyAge,
  SDK_VERSION,
  appearanceToCssVars,
  useKidAgeGate,
  useKidChallenge,
  useKidJurisdictions,
  useKidPermission,
  useKidPermissionSettings,
  useKidSession,
  useKidStrings
};
//# sourceMappingURL=index.js.map