# EXTENDLM / NotebookLM prin MCP

NotebookLM nu are API Google public. Itinerariul real este **ExtendLM** - un
server MCP care expune funcțiile NotebookLM (notebooks, surse, note,
chat, căutare) printr-un flux OAuth cu dynamic client registration.

## Ce s-a măsurat (nu e documentație citită, e răspuns primit)

Metadata-ul serverului de autorizare
(`https://api.extendlm.com/.well-known/oauth-authorization-server`):

| Câmp | Valoare |
|---|---|
| `issuer` | `https://api.extendlm.com` |
| `authorization_endpoint` | `/rest/v1/mcp/oauth/authorize` |
| `token_endpoint` | `/rest/v1/mcp/oauth/token` |
| `revocation_endpoint` | `/rest/v1/mcp/oauth/revoke` |
| `registration_endpoint` | `/rest/v1/mcp/oauth/register` |
| `code_challenge_methods_supported` | `S256` |
| `token_endpoint_auth_methods_supported` | `none` (client public), `private_key_jwt` |
| `client_id_metadata_document_supported` | `true` |
| `scopes_supported` | 30 de valori (`notebooks:read`, `sources:read`, … `automations:write`) |

**Dynamic client registration + PKCE + client public** înseamnă că containerul
se înregistrează singur: **nu trebuie creat niciun client ID de mână** și nu
există niciun client secret care să se scurgă.

## Defect măsurat: `scope: "mcp"` este invalid

Prima încercare de înregistrare a fost respinsă:

```
POST /rest/v1/mcp/oauth/register  ->  400 {"error":"invalid_client_metadata"}
```

Cauza: corpul RFC 7591 trimis conținea `scope: "mcp"`, care nu e o valoare
din `scopes_supported`. Serverul acceptă corpul **fără** câmpul `scope` și își
asignează singur scope-ul (cele 30 de valori). Corecția e în
`container/extendlm-provision.mjs`: corpul nu mai conține `scope`, iar cererea
de autorizare cere **exact scope-ul întors de server**.

`scripts/extendlm-register-probe.mjs` probează 9 variante de metadata și
tipărește care e acceptată - pentru ca următoarea încercare să nu fie o
ghicitoare.

## Fluxul complet

```
node container/extendlm-provision.mjs --port 8799
  1. citește metadata-ul serverului
  2. se înregistrează dinamic (POST /register) -> client_id public
  3. generează PKCE (S256) + state
  4. tipărește AUTH_URL
  5. ascultă pe http://127.0.0.1:8799/callback
  6. schimbă codul (POST /token, code_verifier)
  7. scrie data/extendlm.json  { token, access_token, refresh_token, expires_at, client_id, ... }
```

Un singur pas rămâne al utilizatorului: **logarea pe extendlm.com și
autorizarea**. Restul (schimbul codului, scrierea tokenului) e automat.

## Tokenul

`data/extendlm.json` (volum montat, ca Google):

| Câmp | Folosire |
|---|---|
| `token` | token de acces, așa cum îl citește unealta `notebooklm_ask` |
| `refresh_token` | reînnoire la expirare (`grant_type=refresh_token`) |
| `expires_at` | momentul expirării, calculat din `expires_in` |
| `client_id` | clientul dinamic înregistrat |
| `token_endpoint` | pentru reînnoire |
| `mcp_url` | `https://mcp.extendlm.com/mcp` |

## De ce `notebooklm_ask` trebuie să apeleze unelte reale

O implementare care face doar `initialize` + `tools/list` **nu dovedește**
conexiunea: poate răspunde la fel și cu un token mort, pentru că listează
unelte fără să le execute. De aceea unealta trebuie să:
1. să mintă un token (prin refresh, dacă e expirat),
2. să deschidă sesiunea MCP,
3. să **apeleze** o unealtă reală și să întoarcă răspunsul ei.

Verificarea stă în `scripts/probe-token.mjs` și în probe-ul de servicii, care
raportează `NO_EXTENDLM_TOKEN` dacă fișierul lipsește.

## Ce rămâne deschis (măsurat, nu presupus)

- Extensia Chrome ExtendLM/NotebookLM trebuie legată de contul Google al
  utilizatorului; serverul MCP folosește sesiunea extensiilor.
- Portul 9412 (profilul `minimax-notebooklm` al stratului `google-layer/`) a
  fost măsurat **închis** în timpul acestei sesiuni.
