# AGENTS.md - Mavis-Google_Access

This folder is the working folder for the **permanent Google connection** of
Mavis Local (and of the Cloud side, through the same credential). Optimus CI
lives elsewhere and is handed over to another instance.

## Scope

Everything that touches permanent connectivity to Google services from this
station:

- the `Google_Access` container (one MCP server, one credential)
- the OAuth grant, its scopes, its lifetime
- NotebookLM through ExtendLM
- the browser-side paths (Browser MCP, Chrome DevTools, the `google-layer/`
  scripts)
- the probes that prove all of the above still work

## Rules that are not negotiable here

1. **Measure, don't declare.** A scope list is a claim. A service works only if
   a live API call answered with data. `container/probe-services.mjs` is the
   instrument; `docs/STARE-MASURATA.md` is its output, with a date.
2. **A refusal is a measured answer, not a failure.** `REFUSED` (with Google's
   own code) is a different thing from `ERROR` (nothing answered) and from
   `OK`. Never collapse them.
3. **One invalid scope kills the whole consent request.** Every scope added to
   `FULL_SCOPES` is verified against Google's scope registry or the discovery
   document before it goes in.
4. **One place knows the truth.** API hosts live in `API_BASE` (server.mjs).
   The credential lives in the mounted volume. The image content lives in
   `container/`. The repo is the rebuild source.
5. **Secrets never enter the repo.** `data/` is git-ignored; the image never
   contains the credential (`.dockerignore`).
6. **The authorisation click stays the user's.** Everything else - code
   exchange, credential publication, container restart, probe, notification - is
   automated.
7. **Namespaces stay separate.** `minimax` (this folder, port 8766, its own
   volume, `google-layer/minimax-notebooklm.js` on port 9412) and `Hermes` are
   different universes. If Hermes needs the same capability, build a separate
   instance; never point one at the other's resources.
8. **Commits are automatic on `main`. A push needs the user's R0.** (R0 for
   pushes on this stream was given on 27 Oct 2026 and is consumed by the
   pushes already made; a new push asks again unless it is part of the same
   approved unit.)

## Probes (run them before claiming anything)

```powershell
node "C:\Users\apviz\.minimax\google-access\probe-services.mjs"   # every service, live
node "C:\Users\apviz\.minimax\google-access\state\probe-token.mjs" # what the token carries
docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' Google_Access
Invoke-RestMethod http://127.0.0.1:8766/health
```

## Where the live pieces are

| | |
|---|---|
| Source of the image | `C:\Users\apviz\.minimax\google-access` (synced into `container/` by `scripts/sync-container-source.py`) |
| Credential volume | `C:\Users\apviz\.minimax\google-access\data` → `/data` |
| Secrets volume | `E:\--- System Secrets` → `/secrets` (read only) |
| Google Cloud project | `gen-lang-client-0284509562` ("Sentinel Prime") |
| OAuth client used | `Sentinel Hermes CLI` (Desktop), id `1068987308935-5b7h17gt…` |
| ExtendLM server | `https://mcp.extendlm.com/mcp` (authorization server `https://api.extendlm.com`) |

## Conventions

- Docs are dated and cite the evidence that produced them.
- Corrections are new entries; the append-only journals stay append-only.
- The folder is the only home for this work. If something related appears
  elsewhere, it is referenced here, not copied back and forth.
