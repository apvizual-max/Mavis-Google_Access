# STATE MEASURED — Google Access

**Măsurat:** 2026-10-28, între 00:03Z și 00:40Z (UTC+2).
**Cifrele au o dată.** Ele se re-verifică cu comanda din dreapta; dacă o
cifră nu mai corespunde, cifra e cea greșită, nu realitatea.

---

## 1. Punctul de control

```
node "C:\Users\apviz\.minimax-agent\projects\Mavis-Google_Access\scripts\ga-doctor.mjs"
```

```
CHECK C1.container    OK   status=running health=healthy image=google-access:1.0.9 restart=unless-stopped
CHECK C1b.running-code OK   repo=8429fa512919 running=8429fa512919 match=true
CHECK C2.health       OK   grant=live reauth=false tools=32
CHECK C3.services     OK   OK=14 REFUSED=2[keep,sites] ERROR=0[]
CHECK C4.extendlm     OK   token_minutes_left=220 refresh_token=yes cloud_secret_age_min=21
CHECK C5.browser-mcp  OK   server=minimax-notebooklm tools=4
CHECK C6.mcp-registry OK   enabled=true url=http://127.0.0.1:8766/mcp type=streamable-http
CHECK C10.mcp-paths   OK   checked=23 dead_total=0
CHECK C7.tasks        OK   count=4
CHECK C8.consent      OK   listener alive (processes=1)
CHECK C9.picker       OK   session consumed (2026-10-27T23:48:10.291Z) - nothing to watch
SUMMARY checks=11 failed=0 warnings=0
VERDICT=PASS
```

Exit **0**. Verificări falsificate: `--self-test --fail C1.container` →
`VERDICT=FAIL` exit 2; `--self-test --fail C10.mcp-paths` → `VERDICT=FAIL`
exit 2.

---

## 2. Containerul

| | Valoare | Comanda |
|---|---|---|
| Nume / imagine | `Google_Access` / `google-access:1.0.9` | `docker ps` |
| Stare | `Up 6 hours (healthy)`, `127.0.0.1:8766->8766/tcp` | `docker ps` |
| Restart | `unless-stopped` | `docker inspect` |
| Volum rw | `C:\Users\apviz\.minimax\google-access\data` → `/data` | `docker inspect` |
| Volum ro | `E:\--- System Secrets` → `/secrets` | `docker inspect` |
| Secret în imagine | **niciunul** | verificatorul Docker, `V4` |
| Octeți rulați | `server.mjs` sha256 `8429fa512919…` | `docker exec … node -p` |
| Octeți în repo | `server.mjs` sha256 `8429fa512919…` | `Get-FileHash` |

Cele două hash-uri sunt **egale** — containerul rulează codul din repo.

---

## 3. Grantul și serviciile

| | Valoare |
|---|---|
| Cont | `apvizual@gmail.com` |
| Client OAuth | `1068987308935-5b7h17gt1c5hc4i1m6eginads37o3m2h.apps.googleusercontent.com` |
| Scope-uri | **33** |
| Unelte MCP | **32** |
| Probe live | **OK=14 · REFUSED=2 · ERROR=0 · SKIP=0** |

Refuzurile, cu răspunsul măsurat:

| Serviciu | Răspuns | Motiv |
|---|---|---|
| `keep` | `GOOGLE_HTTP_403` — `PERMISSION_DENIED`, `ACCESS_TOKEN_SCOPE_INSUFFICIENT` | Google nu publică scope acordabil pentru Keep |
| `sites` | `GOOGLE_HTTP_404` | API-ul Google Sites a fost retras |

---

## 4. Taskurile programate

| Task | Cadență | Ultimul rezultat | Următorul |
|---|---|---|---|
| `Google_Access_Watch` | oră | **0** | 02:47 |
| `Google_Access_Consent` | 5 min | **0** | 02:37 |
| `Google_Access_Doctor` | 30 min | **0** | 03:03 |
| `MavisExtendLMHeartbeat` | 30 min | **0** | 02:43 |
| `MavisPickerHeartbeat` | 15 min | **0** | 02:48 |

---

## 5. Extensia MCP și registry-ul

| | Valoare |
|---|---|
| Server înregistrat | `Google_Access`, `type=streamable-http`, `enabled=true` |
| Endpoint | `http://127.0.0.1:8766/mcp` |
| Health | `http://127.0.0.1:8766/health` → `grant=live`, `reauth_required=false`, `tools=32` |
| Serveri în registry | **22** |
| Căi verificate | **23**, moarte **0** |
| `minimax-notebooklm` | handshake real: `server=minimax-notebooklm`, **4 unelte** |
| `gdrive-mcp` | handshake real: **9 unelte** |
| `gmail-mcp` | handshake real: **36 unelte** |
| `docker-mcp` | handshake real: `server=docker-agent`, **19 unelte** |

---

## 6. NotebookLM

| | Valoare |
|---|---|
| Token ExtendLM | viu, **186 minute** rămase la ultima măsurătoare |
| Refresh token | prezent, lungime **87** |
| Secret Cloud | `GOOGLE_EXTENDLM_CREDENTIAL_B64`, vârstă **24 minute** |
| Notebookuri | JULES 182 surse · GEMINI & AI Studio 251 · CV-Automation 98 · SENTINEL Role 225 · AGENTS 8 · TRADE 1 · CV-Notebook 99 · CLIENTS 2 · OPTIMUS System 5 |
| Browser | profil propriu `%LOCALAPPDATA%\minimax-notebooklm\chrome_profile`, CDP **9412** |

---

## 7. Poze

| | Valoare |
|---|---|
| Fișiere capturate | **6**, toate JPEG reale (magic bytes `ff d8 ff`) |
| Locație | `Mavis-Google_Access\state\picked\2026-10-27\` |
| Sesiune | `f4587e83-c9c0-4779-8584-01f7c94d7b6d` — expiră 2026-11-03; marcată `consumed` |
| Captură automată | task `MavisPickerHeartbeat`, la 15 minute |

---

## 8. Repository

| Repo | HEAD | origin/main | Divergență | Arbore |
|---|---|---|---|---|
| `Mavis-Google_Access` | `83f874a` | `83f874a` | 0 / 0 | curat |
| `OPTIMUS-Backbone` | `267ef3c` | `267ef3c` | 0 / 0 | curat (3 foldere de scratch ale altui agent, neatinse) |

Scanări: secrete pe diff indexat `BLOCKS=0 WARNS=0` · encoding `FILES_CHECKED=99
PROBLEMS=0`, zero BOM.

---

## 9. Botul central și membrii

| | Valoare |
|---|---|
| Bot | `skills\mavis-google-access-bot\` |
| Membri | **8** (6 funcționali + 1 meta + registrul) |
| Referințe | **25** |
| Registrul | `bot-registry.mjs verify` → `VERDICT=PASS` |
| Verificatoare ale membrilor | **8**, toate `VERDICT=PASS` |

---

## 10. Busola

Actualizată **pe loc** (nu rescrisă): 811 → 879 rânduri adăugate, conținutul
anterior intact, zero caractere stricate (`U+FFFD`). Instrumentul care o face:
`scripts/append-busola.py`, care refuză să trunchieze și raportează numărul de
rânduri înainte și după.
