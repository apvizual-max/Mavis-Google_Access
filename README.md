# Mavis-Google_Access

**Permanent Google connection for Mavis Local (and for the Cloud side), on this station.**

One Docker container, one MCP server, one credential, no re-authentication friction.

| | |
|---|---|
| Container | `Google_Access` (Docker, image `google-access:1.0.4`) |
| MCP endpoint | `http://127.0.0.1:8766/mcp` (Streamable HTTP, JSON-RPC 2.0) |
| Health | `http://127.0.0.1:8766/health` |
| Credential | one OAuth refresh token, in the mounted volume `data/credentials.json` - **never in an image layer** |
| Grant | 30 scopes on `apvizual@gmail.com`, verified live against `oauth2.googleapis.com/tokeninfo` |
| Source of truth | this folder (`container/` = the exact content of the image) |

The container never touches the network for credentials and never asks for a
second sign-in. If the grant ever dies, the MCP tools say so explicitly
(`MISSING_SCOPE` / `GOOGLE_HTTP_401`) and `google_scope_upgrade` prints the one
consent URL that repairs it in a single browser click.

---

## What is measured, and what is not

`node container/probe-services.mjs` calls every service tool against the live
Google APIs and classifies the ANSWER, not the request:

- `OK` - the API answered with data
- `REFUSED` - the API answered with a refusal (this is a measured refusal, not a crash)
- `ERROR` / `SKIP` - the call did not answer (never reported as success)

Last measured run (2026-10-27, image 1.0.4, grant of 30 scopes):

| Service | Tool | Result |
|---|---|---|
| Identity | `google_auth_status` | OK - `grant_live=true` |
| Drive | `gdrive_list` | OK - real files |
| Gmail | `gmail_list` | OK - real messages |
| Calendar | `gcalendar_list` | OK - real events |
| Books | `gbooks_search` | OK - real volumes |
| Tasks | `gtasks_list` | OK - 1 list |
| Contacts | `gcontacts_list` | OK - 5 contacts |
| Docs | `gdocs_get` | OK - real document |
| Sheets | `gsheets_read` | OK - real sheet |
| Apps Script | `gscript_list` | OK - 1 project |
| YouTube | `youtube_my_videos` | OK - channel data |
| Photos | `gphotos_list` | see `docs/STARE-MASURATA.md` |
| Chat | `gchat_spaces` | see `docs/STARE-MASURATA.md` |
| Keep | `gkeep_list` | refused by Google - no grantable scope exists |
| Sites | `gsites_list` | refused by Google - the API was retired |
| NotebookLM | `notebooklm_ask` | ExtendLM token - see `docs/EXTENDLM.md` |

Two services are refused by Google itself and are reported as such, never
hidden: **Keep** publishes no user-OAuth scope (workspace-admin only) and the
**Sites** API was retired (its scope left Google's registry). Asking for either
scope fails the ENTIRE consent request with `invalid_scope`, which is why they
are absent from the grant.

---

## Rebuilding the container from this folder

```powershell
docker build -t google-access:1.0.4 "C:\Users\apviz\.minimax-agent\projects\Mavis-Google_Access\container"
docker stop Google_Access; docker rm Google_Access
docker run -d --name Google_Access --restart unless-stopped `
  -p 127.0.0.1:8766:8766 -e GA_PORT=8766 `
  -v "C:\Users\apviz\.minimax\google-access\data:/data" `
  -v "E:\--- System Secrets:/secrets:ro" google-access:1.0.4
```

The credential lives in the mounted volume, so recreating the container never
loses the grant.

---

## The documents

| File | What it holds |
|---|---|
| `docs/STARE-MASURATA.md` | measured state, with dates and evidence |
| `docs/ARHITECTURA-GOOGLE-ACCESS.md` | how the pieces fit and why they are shaped this way |
| `docs/PERMANENTA-GOOGLE.md` | how the connection stays alive (publishing status, token lifecycle, repair) |
| `docs/EXTENDLM.md` | NotebookLM through ExtendLM (dynamic client registration, PKCE, real tool calls) |
| `docs/SESSIONE-2026-10-27.md` | what this session did, including every defect found and fixed |
| `docs/TINERE-API-GOOGLE.md` | the per-service API host table and the paths taken from the discovery documents |

## Legal pages

`PRIVACY.md` and `TERMS.md` are the pages the Google consent screen links to.
