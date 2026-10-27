// publish-extendlm-secret.mjs - the owner side of the ExtendLM token.
//
// MEASURED 2026-10-27: the ExtendLM token endpoint ROTATES the refresh token.
// Two instances that refresh from the same copy destroy each other: the second
// rotation invalidates the token the first one just stored. So exactly one
// instance owns the token - this host - and every other instance (the Cloud
// runner) only ever consumes a snapshot, with GA_EXTENDLM_NO_REFRESH=1.
//
// This script is that owner. It:
//   1. refreshes the token against the real endpoint and persists the result
//      (a rotated refresh token MUST be written, or the next refresh fails),
//   2. publishes the fresh snapshot to the Cloud as a repository secret,
//   3. verifies the secret was actually written by reading its timestamp back.
//
// It never prints a token. It prints lengths, labels and HTTP statuses only.
//
// Usage: node publish-extendlm-secret.mjs [--data <dir>] [--repo <owner/name>]
//                                              [--skip-refresh] [--dry-run]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : dflt;
};
const hasFlag = (flag) => process.argv.includes(flag);

const DATA_DIR = argOf("--data", "C:/Users/apviz/.minimax/google-access/data");
const REPO = argOf("--repo", "apvizual-max/MAVIS-CLOUD");
const SECRET_NAME = "GOOGLE_EXTENDLM_CREDENTIAL_B64";
const CFG = path.join(DATA_DIR, "extendlm.json");

function ghBin() {
  const candidates = [
    process.env.GH_PATH,
    "C:/Program Files/GitHub CLI/gh.exe",
    "C:/Program Files (x86)/GitHub CLI/gh.exe",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      fs.accessSync(c);
      return c;
    } catch {
      /* try the next one */
    }
  }
  return "gh"; // PATH lookup
}

function gh(args, opts) {
  return execFileSync(ghBin(), args, Object.assign({ encoding: "utf8", windowsHide: true }, opts || {}));
}

async function refresh(cfg) {
  const res = await fetch(cfg.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: cfg.refresh_token,
      client_id: cfg.client_id,
    }).toString(),
  });
  const text = await res.text();
  console.log("REFRESH_HTTP=" + res.status);
  if (!res.ok) {
    console.log("REFRESH_BODY=" + text.slice(0, 300));
    return null;
  }
  const j = JSON.parse(text);
  const rotated = Boolean(j.refresh_token && j.refresh_token !== cfg.refresh_token);
  const now = Date.now();
  const next = {
    ...cfg,
    token: j.access_token,
    access_token: j.access_token,
    refresh_token: j.refresh_token || cfg.refresh_token,
    token_type: j.token_type || cfg.token_type || "Bearer",
    scope: j.scope || cfg.scope,
    expires_at: j.expires_in ? now + Number(j.expires_in) * 1000 : null,
    refreshed_at: new Date(now).toISOString(),
  };
  const tmp = CFG + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tmp, CFG);
  console.log(
    "TOKEN_LEN=" + (next.token ? next.token.length : 0) +
      " ROTATED_REFRESH=" + (rotated ? 1 : 0) +
      " EXPIRES_AT=" + (next.expires_at ? new Date(next.expires_at).toISOString() : "none")
  );
  return next;
}

(async () => {
  if (!fs.existsSync(CFG)) {
    console.log("NO_CREDENTIAL_FILE=" + CFG);
    process.exitCode = 3;
    return;
  }
  let cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
  console.log("BEFORE token_len=" + (cfg.token ? cfg.token.length : 0) + " refresh_len=" + (cfg.refresh_token ? cfg.refresh_token.length : 0));

  if (!hasFlag("--skip-refresh")) {
    if (!cfg.refresh_token) {
      console.log("NO_REFRESH_TOKEN: re-authorize with extendlm-provision.mjs");
      process.exitCode = 3;
      return;
    }
    const next = await refresh(cfg);
    if (!next) {
      console.log("VERDICT=REFRESH_FAILED");
      process.exitCode = 2;
      return;
    }
    cfg = next;
  } else {
    console.log("REFRESH=skipped");
  }

  const bytes = fs.readFileSync(CFG);
  const b64 = Buffer.from(bytes).toString("base64");
  console.log("SNAPSHOT_BYTES=" + bytes.length + " B64_LEN=" + b64.length);

  if (hasFlag("--dry-run")) {
    console.log("DRY_RUN=1 (secret not written)");
    console.log("VERDICT=DRY_RUN_OK");
    return;
  }

  try {
    gh(["secret", "set", SECRET_NAME, "--repo", REPO, "--body", b64]);
    console.log("SECRET_WRITE=ok name=" + SECRET_NAME + " repo=" + REPO);
  } catch (e) {
    console.log("SECRET_WRITE=error " + (e && e.message ? String(e.message).split("\n")[0] : String(e)));
    console.log("VERDICT=SECRET_WRITE_FAILED");
    process.exitCode = 2;
    return;
  }

  // A write that was not confirmed is not a write. Read the timestamp back.
  let verdict = "VERDICT=PUBLISHED";
  try {
    const raw = gh(["secret", "list", "--repo", REPO, "--json", "name,updatedAt"], { stdio: ["ignore", "pipe", "pipe"] });
    const list = JSON.parse(raw);
    const row = list.find((r) => r.name === SECRET_NAME);
    if (!row) {
      console.log("SECRET_READBACK=absent");
      verdict = "VERDICT=SECRET_ABSENT_AFTER_WRITE";
    } else {
      const age = (Date.now() - Date.parse(row.updatedAt)) / 1000;
      console.log("SECRET_READBACK=present updatedAt=" + row.updatedAt + " age_seconds=" + Math.round(age));
      if (age > 300) {
        console.log("SECRET_READBACK=stale (older than 300s)");
        verdict = "VERDICT=SECRET_STALE_AFTER_WRITE";
      }
    }
  } catch (e) {
    console.log("SECRET_READBACK=error " + (e && e.message ? String(e.message).split("\n")[0] : String(e)));
    verdict = "VERDICT=READBACK_FAILED";
  }
  console.log(verdict);
  if (verdict !== "VERDICT=PUBLISHED") process.exitCode = 2;
})().catch((e) => {
  console.log("ERROR=" + (e && e.message ? e.message : String(e)));
  process.exitCode = 2;
});
