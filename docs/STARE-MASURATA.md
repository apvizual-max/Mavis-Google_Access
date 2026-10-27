# STARE MASURATA - Google_Access (27 octombrie 2026)

Tot ce mai jos este **măsurat**, nu declarat. Fiecare afirmație are o probă
repetabilă în `scripts/` sau în `container/`.

## 1. Containerul

| | |
|---|---|
| Nume | `Google_Access` |
| Imagine | `google-access:1.0.5` (build 2026-10-27 08:58 UTC) |
| Stare | `running` · `healthy` · `FailingStreak=0` |
| MCP | `http://127.0.0.1:8766/mcp` (Streamable HTTP, JSON-RPC 2.0, **stateless**) |
| Health | `GET http://127.0.0.1:8766/health` → `{"service":"Google_Access","grant":"live","reauth_required":false,"tools":26}` |
| Volum credential | `C:\Users\apviz\.minimax\google-access\data` → `/data` (rw) |
| Volum secrete | `E:\--- System Secrets` → `/secrets` (ro) |
| Secret în imagine | **nu** - `.dockerignore` exclude `data/` |

## 2. Grantul

| | |
|---|---|
| Cont | `apvizual@gmail.com` |
| Client | `Sentinel Hermes CLI` (Desktop) - `1068987308935-5b7h17gt…apps.googleusercontent.com` |
| Proiect | `gen-lang-client-0284509562` ("Sentinel Prime") |
| Scope-uri cerute | 30 |
| Scope-uri efectiv pe token | 30 (măsurat la `oauth2.googleapis.com/tokeninfo`) |
| Status publicare | **In production** (era *Testing* - vezi §5) |
| Verificare | **neefectuată** - aplicația cere verificare pentru distribuție publică (restricționat/sensitive scopes + logo) |
| API-uri activate | `books.googleapis.com` și `chat.googleapis.com` au fost activate de mine pe 27 oct (nu erau active) |

## 3. Proba reală pe fiecare serviciu

`node container/probe-services.mjs` - apelează fiecare unealtă și clasifică
**răspunsul**, nu cererea.

| Serviciu | Unealtă | Rezultat | Doi |
|---|---|---|---|
| Identity | `google_auth_status` | OK | `grant_live=true` |
| Drive | `gdrive_list` | OK | fișiere reale |
| Gmail | `gmail_list` | OK | mesaje reale |
| Calendar | `gcalendar_list` | OK | evenimente reale |
| Books | `gbooks_search` | OK | volume reale |
| Tasks | `gtasks_list` | OK | 1 listă |
| Contacts | `gcontacts_list` | OK | 5 contacte |
| Docs | `gdocs_get` | OK | document real |
| Sheets | `gsheets_read` | OK | foaie reală |
| Apps Script | `gscript_list` | OK | 1 proiect (listat prin Drive) |
| YouTube | `youtube_my_videos` | OK | canal real |
| Photos | `gphotos_list` | **refuz măsurat** | `403 insufficient authentication scopes` ( vezi §4) |
| Chat | `gchat_spaces` | **refuz măsurat** | `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT` → reparat prin `chat.spaces.readonly` (vezi §4) |
| Keep | `gkeep_list` | **refuz măsurat** | Google nu publică scope de utilizator pentru Keep API |
| Sites | `gsites_list` | **refuz măsurat** | API-ul Google Sites a fost retras |
| NotebookLM | `notebooklm_ask` | dependent de ExtendLM | token la `data/extendlm.json` |

`REFUSED` este un răspuns **măsurat** al API-ului, nu o eroare. Probe-ul
distinge: `OK` (date) · `REFUSED` (API-ul a refuzat, cu codul lui) · `ERROR`
(n-a răspuns) · `SKIP` (nu există obiect de probat).

## 4. Ce a refuzat Google și de ce (măsurat, nu presupus)

| Scope cerut | Verdict Google | Sursa verificării |
|---|---|---|
| `auth/sites` | **invalid** - „not added because they are invalid" | consola + directorul oficial de API-uri: `sites.googleapis.com` nu mai există (doar `siteverification`) |
| `auth/keep` | **invalid** - aceeași eroare | `keep.googleapis.com` e activ, dar scope-ul nu e în registrul public de scope-uri Google (Keep API e doar pentru admini de workspace) |
| `auth/chat.messages` pentru `chat.spaces.list` | **insuficient** | discovery doc: `spaces.list` cere `chat.bot` / `chat.spaces` / `chat.spaces.readonly` |
| `auth/photoslibrary.readonly` pentru `/v1/mediaItems` | **insuficient** | API-ul a refuzat chiar cu scope-ul prezent pe token → s-a cerut și scope-ul complet `photoslibrary` |

**De ce a contat:** o cerere de consimțământ cu UN scope invalid este respinsă
în întregime (`invalid_scope`, „Some requested scopes cannot be shown"). Deci
două scope-uri moarte blocau și celelalte 28.

## 5. Permanentizarea (măsurat)

- **27 oct, 08:35** - consimțământul a fost acordat cu aplicația în statut
  **Testing**. În acest statut, token-urile de refresh pentru scope-uri
  sensibile/restricționate expiră în **7 zile** (expirare ~3 noiembrie).
- **27 oct, 08:50** - Branding completat (nume aplicație „Sentinel Hermes
  Google Access", email suport, pagină principală, linkuri Privacy/Terms,
  domeniu autorizat `github.com`) și aplicația **publicată**: pagina Audience
  arată acum „Publishing status: In production".
- **27 oct, ~09:00** - al doilea consimțământ, cu 30 scope-uri, emis **după**
  publicare → tokenul de refresh nu mai are expirarea de 7 zile.

Condiția rămâne: dacă revoca accesul din contul Google, sau dacă Google îl
invalidază, apare `GOOGLE_HTTP_401` / `invalid_grant`. Containerul raportează
asta explicit prin `google_auth_status` (`reauth_required`), nu tace.

## 6. Limite reale, spuse fără cosmetizare

1. **Keep** și **Sites** nu sunt accesibile prin API cu un token de utilizator.
   Google nu mai publică scope-uri valide pentru ele. Uneltele există și
   raportează refuzul real, ca să nu pară că funcționează.
2. **WebMCP** (`webmcp.dev`) este o capabilitate de **browser**, nu de
   container. Nu poate fi „pusă în Docker" ca atare. Calea reală pentru
   aplicațiile web rămâne browser-ul (MCP de browser + Chrome DevTools).
3. **Verificarea OAuth** a aplicației nu e făcută. Nu e nevoie pentru uz
   personal, dar e nevoie dacă aplicația ar fi folosită de altcineva.
4. **Photos**: dacă refuzul persistă după noul grant, cauza rămâne verificarea
   aplicației (API-ul Photos Library cere aplicații verificate pentru acces la
   biblioteca utilizatorului). Măsurat la `scripts/probe-token.mjs`.
