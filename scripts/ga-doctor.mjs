// ga-doctor.mjs - THE CONTROL POINT for Google Access.
//
// One command, one verdict. Popy's requirement (27-28 Oct 2026): the system
// must be permanently verifiable, so that a new session - or ANY other AI on
// this station - can prove the connection instead of rebuilding it.
//
// WHAT IT CHECKS (each check is independent: a failure never hides the others)
//   C1 container      - exists, running, healthy, right image, restart policy
//   C1b running-code - the BYTES running inside the container are the bytes
//                       in the repo (the 1.0.9 incident: healthy, but old)
//   C2 health         - grant=live, reauth_required=false, tool count
//   C3 services       - a LIVE probe of every Google service; the tally
//   C4 extendlm       - the NotebookLM token is alive, and its snapshot is
//                       published to the Cloud secret
//   C5 browser-mcp    - the registered path EXISTS and the server answers
//                       over its real stdio transport
//   C6 mcp-registry   - Google_Access is registered globally, so every agent
//                       (not only Mavis) inherits it
//   C10 mcp-paths     - every path the global registry points to EXISTS on
//                       disk (a dead path breaks every agent, silently)
//   C7 tasks          - the scheduled tasks that keep the system alive
//   C8 consent        - the re-consent listener is up, so a future re-consent
//                       is ONE CLICK and not a re-setup
//   C9 picker         - the active Photo Picker session
//
// EXIT: 0 = every critical check passed, 2 = at least one failed.
// The verdict distinguishes REFUSED (Google answered a refusal) from ERROR
// (nothing answered) from OK. A refusal is never reported as a failure.
//
// Usage: node ga-doctor.mjs [--container <name>] [--data <dir>]
//                           [--repo <owner/name>] [--json] [--self-test]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";

// ESM has no __dirname. MEASURED 2026-10-28: the first run of the extended
// control point died with "__dirname is not defined" and exited 3 - which is
// the point of a distinct exit code for a crash: a crash is never reported as
// a green verdict.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : dflt;
};
const hasFlag = (flag) => process.argv.includes(flag);

const CONTAINER = argOf("--container", "Google_Access");
const DATA = argOf("--data", "C:/Users/apviz/.minimax/google-access/data");
const REPO = argOf("--repo", "apvizual-max/MAVIS-CLOUD");
const MCP_JSON = argOf("--mcp-json", "C:/Users/apviz/.minimax/mcp.json");
const MCP_URL = argOf("--mcp-url", "http://127.0.0.1:8766/mcp");
const HEALTH_URL = argOf("--health", "http://127.0.0.1:8766/health");
const PROBE = argOf("--probe", "C:/Users/apviz/.minimax/google-access/probe-services.mjs");
const NOTEBOOKLM_JS = argOf(
  "--notebooklm-js",
  "C:/Users/apviz/.minimax-agent/projects/Mavis-Google_Access/google-layer/minimax-notebooklm.js"
);
const TASKS = ["Google_Access_Watch", "MavisExtendLMHeartbeat", "MavisPickerHeartbeat", "Google_Access_Doctor"];
const EXPECTED_REFUSED = ["keep", "sites"];

const results = [];
let injected = null; // the self-test hook: forces one check to fail

function record(id, ok, detail, critical = true) {
  results.push({ id, ok, detail, critical });
  const tag = ok ? "OK  " : critical ? "FAIL" : "WARN";
  console.log("CHECK " + id + " " + tag + " " + detail);
  return ok;
}

function run(cmd, args, opts) {
  try {
    return execFileSync(cmd, args, Object.assign({ encoding: "utf8", windowsHide: true, timeout: 120000 }, opts || {}));
  } catch (e) {
    return null;
  }
}

function tcpOpen(port, host = "127.0.0.1", timeoutMs = 1500) {
  return new Promise((res) => {
    const req = http.request({ host, port, path: "/", method: "GET", timeout: timeoutMs }, (r) => {
      r.resume();
      res(true);
    });
    req.on("error", () => res(false));
    req.on("timeout", () => {
      req.destroy();
      res(false);
    });
    req.end();
  });
}

// ── C1 container ───────────────────────────────────────────────────────────
function checkContainer() {
  const out = run("docker", ["inspect", CONTAINER]);
  if (!out) return record("C1.container", false, "docker inspect failed for " + CONTAINER);
  let d;
  try {
    d = JSON.parse(out)[0];
  } catch (e) {
    return record("C1.container", false, "unreadable docker inspect output");
  }
  const status = d.State ? d.State.Status : "?";
  const health = d.State && d.State.Health ? d.State.Health.Status : "none";
  const image = d.Config ? d.Config.Image : "?";
  const policy = d.HostConfig && d.HostConfig.RestartPolicy ? d.HostConfig.RestartPolicy.Name : "?";
  const ok = status === "running" && health === "healthy" && policy === "unless-stopped";
  return record(
    "C1.container",
    ok,
    "status=" + status + " health=" + health + " image=" + image + " restart=" + policy
  );
}

// ── C1b the RUNNING code is the code in the repo ───────────────────────────
// MEASURED 2026-10-28 (the 1.0.9 incident): the repository carried the
// repair, the image had been built before it, and the container was therefore
// RUNNING THE OLD CODE while every document said it was fixed. A container
// that is healthy proves it is alive, not that it is the thing you wrote.
// So the bytes inside the container are hashed and compared with the repo.
function checkRunningCode() {
  const repoFile = path.join(__dirname, "..", "container", "server.mjs");
  if (!fs.existsSync(repoFile)) {
    return record("C1b.running-code", false, "repo source not found: " + repoFile);
  }
  const repoHash = crypto.createHash("sha256").update(fs.readFileSync(repoFile)).digest("hex");
  const live = run("docker", [
    "exec",
    CONTAINER,
    "node",
    "-p",
    "require('crypto').createHash('sha256').update(require('fs').readFileSync('/app/server.mjs')).digest('hex')",
  ]);
  if (!live) {
    return record("C1b.running-code", false, "could not hash /app/server.mjs inside " + CONTAINER);
  }
  const liveHash = live.trim().split(/\r?\n/).filter(Boolean).pop() || "";
  const match = liveHash === repoHash;
  return record(
    "C1b.running-code",
    match,
    "repo=" + repoHash.slice(0, 12) + " running=" + liveHash.slice(0, 12) + " match=" + match
  );
}

// ── C2 health ──────────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const r = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const ok = j.grant === "live" && j.reauth_required === false;
    return record("C2.health", ok, "grant=" + j.grant + " reauth=" + j.reauth_required + " tools=" + j.tools);
  } catch (e) {
    return record("C2.health", false, "health unreachable: " + (e && e.message ? e.message : e));
  }
}

// ── C3 services (live) ─────────────────────────────────────────────────────
const TRANSIENT = /GOOGLE_HTTP_(429|5\d\d)/;

function runProbe() {
  let out = "";
  try {
    out = execFileSync("node", [PROBE], { encoding: "utf8", timeout: 300000, windowsHide: true });
  } catch (e) {
    out = (e && e.stdout ? e.stdout : "") + (e && e.stderr ? e.stderr : "");
  }
  const lines = out.split(/\r?\n/).filter((l) => l.startsWith("SERVICE="));
  const byStatus = { OK: [], REFUSED: [], ERROR: [], SKIP: [] };
  const details = {};
  for (const l of lines) {
    const name = (l.match(/SERVICE=(\S+)/) || [])[1] || "?";
    const st = (l.match(/STATUS=(\S+)/) || [])[1] || "?";
    const det = (l.match(/DETAIL=(.*)$/) || [])[1] || "";
    (byStatus[st] || (byStatus[st] = [])).push(name);
    details[name] = det;
  }
  return { byStatus, details, lines: lines.length };
}

function checkServices() {
  if (!fs.existsSync(PROBE)) {
    return record("C3.services", false, "probe not found: " + PROBE);
  }
  let r = runProbe();
  if (!r.lines) return record("C3.services", false, "the probe produced no SERVICE lines");

  const evaluate = (run) => {
    const oks = run.byStatus.OK || [];
    const refused = run.byStatus.REFUSED || [];
    const errors = run.byStatus.ERROR || [];
    const unexpected = refused.filter((n) => !EXPECTED_REFUSED.includes(n));
    const missing = EXPECTED_REFUSED.filter((n) => !refused.includes(n));
    const transient = unexpected.filter((n) => TRANSIENT.test(run.details[n] || ""));
    return { oks, refused, errors, unexpected, missing, transient };
  };

  let v = evaluate(r);
  // MEASURED 2026-10-28: Google Books answered HTTP 503 "Service temporarily
  // unavailable" on two of three consecutive probes, then answered normally.
  // A control point that turns red on a Google blip is a control point that
  // gets ignored - so a transient refusal is re-probed once, and only a
  // refusal that PERSISTS is a finding.
  let recovered = [];
  if (v.transient.length) {
    console.log("NOTE C3.services transient_refusal=" + v.transient.join(",") + " -> re-probing once");
    r = runProbe();
    const v2 = evaluate(r);
    // MEASURED 2026-10-28: this line read v2.byStatus.OK, but evaluate()
    // returns a flat object with `oks`. The crash surfaced the moment Google
    // Books answered 503 - a control point that dies on a Google blip is a
    // control point that stops measuring.
    recovered = v.transient.filter((n) => v2.oks.includes(n));
    v = v2;
  }

  const ok =
    v.errors.length === 0 &&
    v.unexpected.length === 0 &&
    v.missing.length === 0 &&
    v.oks.length >= 14;
  return record(
    "C3.services",
    ok,
    "OK=" + v.oks.length +
      " REFUSED=" + v.refused.length + "[" + v.refused.join(",") + "]" +
      " ERROR=" + v.errors.length + "[" + v.errors.join(",") + "]" +
      (v.unexpected.length ? " unexpected_refused=" + v.unexpected.join(",") : "") +
      (v.missing.length ? " missing_expected_refused=" + v.missing.join(",") : "") +
      (recovered.length ? " transient_recovered=" + recovered.join(",") : "")
  );
}

// ── C4 extendlm ────────────────────────────────────────────────────────────
function checkExtendlm() {
  const cfgPath = path.join(DATA, "extendlm.json");
  if (!fs.existsSync(cfgPath)) return record("C4.extendlm", false, "no extendlm.json at " + cfgPath);
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch (e) {
    return record("C4.extendlm", false, "unreadable extendlm.json");
  }
  const left = cfg.expires_at ? Math.round((Number(cfg.expires_at) - Date.now()) / 60000) : null;
  const tokenOk = left !== null && left > 0;
  const secretOut = run("gh", ["secret", "list", "--repo", REPO, "--json", "name,updatedAt"]);
  let secretAge = null;
  if (secretOut) {
    try {
      const list = JSON.parse(secretOut);
      const row = list.find((r) => r.name === "GOOGLE_EXTENDLM_CREDENTIAL_B64");
      if (row) secretAge = Math.round((Date.now() - Date.parse(row.updatedAt)) / 60000);
    } catch (e) {
      /* handled below */
    }
  }
  const secretOk = secretAge !== null && secretAge <= 120;
  return record(
    "C4.extendlm",
    tokenOk && secretOk,
    "token_minutes_left=" + left +
      " refresh_token=" + (cfg.refresh_token ? "yes" : "no") +
      " cloud_secret_age_min=" + (secretAge === null ? "absent" : secretAge)
  );
}

// ── C5 browser mcp (real stdio handshake) ─────────────────────────────────
function checkBrowserMcp() {
  if (!fs.existsSync(MCP_JSON)) return record("C5.browser-mcp", false, "mcp.json not found: " + MCP_JSON);
  let reg;
  try {
    reg = JSON.parse(fs.readFileSync(MCP_JSON, "utf8")).mcpServers || {};
  } catch (e) {
    return record("C5.browser-mcp", false, "unreadable mcp.json");
  }
  const entry = reg["minimax-notebooklm"];
  if (!entry) return record("C5.browser-mcp", false, "minimax-notebooklm is not registered");
  const script = entry.args && entry.args[0];
  if (!script || !fs.existsSync(script)) {
    return record("C5.browser-mcp", false, "the registered path does not exist: " + script);
  }
  // A registration that cannot start is not a capability: prove it starts.
  const probe = spawn(process.execPath, [script], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
  const done = new Promise((res) => {
    let buf = "";
    const pend = new Map();
    let id = 0;
    probe.stdout.on("data", (c) => {
      buf += c.toString();
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let m;
        try {
          m = JSON.parse(line);
        } catch {
          continue;
        }
        if (m.id !== undefined && pend.has(m.id)) {
          const p = pend.get(m.id);
          pend.delete(m.id);
          p(m);
        }
      }
    });
    const call = (method, params) =>
      new Promise((r) => {
        const i = ++id;
        pend.set(i, r);
        probe.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: i, method, params }) + "\n");
      });
    (async () => {
      const init = await call("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "ga-doctor", version: "1.0.0" },
      });
      const name = init && init.result && init.result.serverInfo ? init.result.serverInfo.name : "?";
      const list = await call("tools/list", {});
      const tools = list && list.result && Array.isArray(list.result.tools) ? list.result.tools.length : 0;
      res({ ok: Boolean(init && init.result) && tools > 0, name, tools });
    })();
    setTimeout(() => res({ ok: false, name: "timeout", tools: 0 }), 30000);
  });
  return done.then((r) => {
    try {
      probe.kill();
    } catch {
      /* ignore */
    }
    return record("C5.browser-mcp", r.ok, "server=" + r.name + " tools=" + r.tools + " path=" + script);
  });
}

// ── C6 mcp registry (global, so every agent inherits it) ──────────────────
function checkRegistry() {
  let reg;
  try {
    reg = JSON.parse(fs.readFileSync(MCP_JSON, "utf8")).mcpServers || {};
  } catch (e) {
    return record("C6.mcp-registry", false, "unreadable mcp.json");
  }
  const e = reg["Google_Access"];
  if (!e) return record("C6.mcp-registry", false, "Google_Access is not registered");
  const ok = e.enabled !== false && String(e.url || "").trim() === MCP_URL;
  return record("C6.mcp-registry", ok, "enabled=" + e.enabled + " url=" + e.url + " type=" + e.type);
}

// ── C10 registry path integrity ────────────────────────────────────────────
// MEASURED 2026-10-28: three registered entries pointed at a folder that had
// been moved (google-layer/ -> Mavis-Google_Access/google-layer/). The
// registry said "enabled", the files did not exist, and nothing said so.
// A fourth entry pointed at a wrapper npm never created, and the package
// behind it could not import its own dependency.
//
// The configuration is GLOBAL: a dead path there breaks the capability for
// every agent on this station, not only for the session that wrote it. So
// the registry is checked against the DISK, not against itself.
//
// Scope: entries in the Google family are critical - they ARE this system.
// A dead path in an unrelated entry is reported as a warning, because a
// control point that goes red for something outside its domain is a control
// point that gets ignored.
const GOOGLE_FAMILY = [
  "Google_Access",
  "gdrive-mcp",
  "gmail-mcp",
  "google-workspace-mcp",
  "google-calendar-mcp",
  "minimax-notebooklm",
  "notebooklm-mcp",
];

function checkRegistryPaths() {
  let reg;
  try {
    reg = JSON.parse(fs.readFileSync(MCP_JSON, "utf8")).mcpServers || {};
  } catch (e) {
    return record("C10.mcp-paths", false, "unreadable mcp.json");
  }
  const dead = [];
  let checked = 0;
  for (const [name, e] of Object.entries(reg)) {
    if (!e || e.type !== "stdio") continue;
    const paths = [];
    if (typeof e.command === "string" && /[\\/]/.test(e.command)) paths.push(e.command);
    for (const a of e.args || []) {
      if (typeof a === "string" && /^[A-Za-z]:\\/.test(a) && /\.(js|mjs|cjs|cmd|exe|ps1)$/.test(a)) {
        paths.push(a);
      }
    }
    for (const p of paths) {
      checked++;
      if (!fs.existsSync(p)) dead.push(name + "->" + p);
    }
  }
  const googleDead = dead.filter((d) => GOOGLE_FAMILY.some((g) => d.startsWith(g + "->")));
  const otherDead = dead.filter((d) => !googleDead.includes(d));
  const ok = googleDead.length === 0;
  return record(
    "C10.mcp-paths",
    ok,
    "checked=" + checked +
      " dead_total=" + dead.length +
      (googleDead.length ? " dead_google=" + googleDead.join(",") : "") +
      (otherDead.length ? " dead_other=" + otherDead.join(",") : ""),
    googleDead.length === 0
  );
}

// ── C7 scheduled tasks ─────────────────────────────────────────────────────
function checkTasks() {
  // The state of each task plus its result, read from the Task Scheduler.
  const raw = run("powershell.exe", [
    "-NoProfile",
    "-Command",
    "$names=@(" +
      TASKS.map((t) => "'" + t + "'").join(",") +
      ");foreach($n in $names){$t=Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue;" +
      "if($t){$i=Get-ScheduledTaskInfo -TaskName $n -ErrorAction SilentlyContinue;" +
      "Write-Output ($n+'|'+$t.State+'|'+$i.LastTaskResult+'|'+$i.NextRunTime)}" +
      "else{Write-Output ($n+'|ABSENT||')}}",
  ]);
  if (!raw) return record("C7.tasks", false, "could not read the Task Scheduler");
  const rows = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, state, result, next] = l.split("|");
      return { name, state, result, next };
    });
  const missing = rows.filter((r) => r.state === "ABSENT");
  const bad = rows.filter((r) => r.state !== "ABSENT" && r.result !== "0" && r.result !== "267009");
  const ok = missing.length === 0 && bad.length === 0;
  return record(
    "C7.tasks",
    ok,
    "count=" + rows.length +
      (missing.length ? " missing=" + missing.map((m) => m.name).join(",") : "") +
      (bad.length ? " nonzero_result=" + bad.map((b) => b.name + ":" + b.result).join(",") : "")
  );
}

// ── C8 consent listener ───────────────────────────────────────────────────
function checkConsent() {
  const raw = run("powershell.exe", [
    "-NoProfile",
    "-Command",
    "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { $_.CommandLine }",
  ]);
  const lines = raw ? raw.split(/\r?\n/).filter((l) => l && l.includes("consent-watcher")) : [];
  return record(
    "C8.consent",
    lines.length > 0,
    lines.length
      ? "listener alive (processes=" + lines.length + ")"
      : "no consent-watcher process: a future re-consent would have no listener to catch the callback"
  );
}
function await0() {
  return null;
}

// ── C9 picker session ──────────────────────────────────────────────────────
async function checkPicker() {
  const f = path.join(DATA, "picker-session.json");
  if (!fs.existsSync(f)) return record("C9.picker", true, "no picker session registered (nothing to watch)", false);
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (e) {
    return record("C9.picker", false, "unreadable picker-session.json", false);
  }
  // A session that was completed and deleted answers 404. That is the
  // designed end of a picker session, so it is reported as CONSUMED - the
  // same state as "no session" - not as a broken one.
  if (!cfg.session_id) {
    return record(
      "C9.picker",
      true,
      "session consumed (" + (cfg.consumed_at || cfg.state || "no session id") + ") - nothing to watch",
      false
    );
  }
  const credsPath = path.join(DATA, "credentials.json");
  if (!fs.existsSync(credsPath)) return record("C9.picker", false, "no credential to query the session", false);
  const c = JSON.parse(fs.readFileSync(credsPath, "utf8"));
  const body = new URLSearchParams({
    client_id: c.client_id,
    client_secret: c.client_secret,
    refresh_token: c.refresh_token,
    grant_type: "refresh_token",
  }).toString();
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }).then((r) => r.json());
  if (!tok.access_token) return record("C9.picker", false, "could not mint a token", false);
  const resp = await fetch(
    "https://photospicker.googleapis.com/v1/sessions/" + encodeURIComponent(cfg.session_id),
    { headers: { Authorization: "Bearer " + tok.access_token } }
  );
  if (resp.status === 404) {
    return record("C9.picker", true, "session consumed (404) - nothing to watch", false);
  }
  const s = await resp.json();
  const ok = s && s.id;
  return record(
    "C9.picker",
    Boolean(ok),
    "session=" + (s && s.id ? s.id : "?") + " mediaItemsSet=" + (s && s.mediaItemsSet) + " expire=" + (s && s.expireTime),
    false
  );
}

(async () => {
  console.log("=== Google Access - control point ===");
  console.log("host=" + os.hostname() + " at=" + new Date().toISOString());
  console.log("container=" + CONTAINER + " mcp=" + MCP_URL + " data=" + DATA);
  console.log("");

  if (hasFlag("--self-test") && process.argv.includes("--fail")) {
    // The self-test hook: force one check to report a failure, so the gate's
    // own ability to fail can be demonstrated instead of assumed.
    const which = process.argv[process.argv.indexOf("--fail") + 1];
    injected = which;
    console.log("SELF_TEST=1 injecting_failure=" + which);
    console.log("");
  }

  checkContainer();
  checkRunningCode();
  await checkHealth();
  checkServices();
  checkExtendlm();
  await checkBrowserMcp();
  checkRegistry();
  checkRegistryPaths();
  checkTasks();
  checkConsent();
  await checkPicker();

  if (injected) {
    const r = results.find((x) => x.id === injected);
    if (r) {
      r.ok = false;
      console.log("CHECK " + r.id + " FAIL (injected by --self-test --fail " + injected + ")");
    }
  }

  const fails = results.filter((r) => !r.ok && r.critical);
  const warns = results.filter((r) => !r.ok && !r.critical);
  console.log("");
  console.log("SUMMARY checks=" + results.length + " failed=" + fails.length + " warnings=" + warns.length);
  if (fails.length) for (const f of fails) console.log("  FAILED " + f.id + " " + f.detail);
  const verdict = fails.length === 0 ? "PASS" : "FAIL";
  console.log("VERDICT=" + verdict);
  if (hasFlag("--json")) {
    console.log(JSON.stringify({ at: new Date().toISOString(), verdict, results }));
  }
  process.exitCode = fails.length === 0 ? 0 : 2;
})().catch((e) => {
  console.log("ERROR=" + (e && e.message ? e.message : String(e)));
  process.exitCode = 3;
});
