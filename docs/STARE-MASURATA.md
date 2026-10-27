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
4. **Photos**: refuzul **nu** vine din grant și **nu** din verificarea aplicației.
   Măsurat: tokenul duce `photoslibrary` + `photoslibrary.readonly` +
   `photoslibrary.appendonly`, API-ul e activ în proiectul clientului OAuth,
   contul are bibliotecă reală (100,4 GB folosite), iar același token răspunde
   200 pe Drive (control). Cauza e regula Google: din **31 martie 2025**
   scope-urile `photoslibrary.readonly` / `photoslibrary` / `photoslibrary.sharing`
   au fost retrase - rămâne accesul doar la conținutul creat de aplicație
   (`photoslibrary.readonly.appcreateddata`), iar citirea bibliotecii trece prin
   Picker API, care cere un `pollingUri` public. Sursa:
   https://developers.google.com/photos/library/guides/authorization

## 7. 27 oct 2026, 11:19-12:05 - consimțământul #2, defectul de cale, cauza Photos

### 7.1 Clickul lui Popy a ajuns la capăt, dar schimbul codului a murit
Măsurat: `CODE_RECEIVED=1` de două ori (11:25:41, 11:25:56), `PROVISION_EXIT=1`
în ambele, `scope_count=0`. Cauza, cuvânt cu cuvânt, din `provision_output`:
`Cannot find module '...projects\google-layer\google-grant.js'`.
`provision-grant.cjs` cerea modulul printr-o **cale absolută hardcodată**, iar
folderul `google-layer` se mutase în `Mavis-Google_Access\google-layer` cu
consolidarea. Deci: clickul fusese consumat de două ori, iar schimbul nu se
putuse face - **defectul a apărut după ce omul acționase**.

Reparație, la sursă, nu prin mutarea unui literal: rezolvare prin listă de
candidați (`GA_LAYER_DIR` -> `google-layer` lângă script -> rădăcinile de
proiect) + ieșire **loud 7** cu lista căutată, în loc de stack trace; plus o
copie a modulului lângă script, ca hostul să nu depindă de locul repo-ului.
Probă: `GRANT_MODULE=<cale>` + `TOKEN_ENDPOINT_HTTP=400 invalid_grant` +
`NO_CHANGE=1` - modulul se încarcă, Google răspunde, credentialul nu e atins.

### 7.2 Consimțământul #2, cu 30 scope-uri - obținut
`CODE_RECEIVED=1` (11:37:52) -> `PROVISION_EXIT=0` -> `SCOPES=30` ->
`RESTART_EXIT=0` -> `PROBE_EXIT=0` -> `VERDICT=PASS`. Lanțul s-a dus singur
după click: schimb, publicare în volum, restart container, probă, notificare.
`photoslibrary` și `chat.spaces.readonly` au intrat în token.

### 7.3 Chat a trecut, Photos nu - și cauza nu e a mea
Probă pe 16 servicii: **chat OK** (15 spații; era REFUSED), **photos încă
REFUSED** (403). Izolat cu `scripts/probe-photos.mjs`: tokenul duce cele trei
scope-uri Photos, `mediaItems.list` și `albums.list` dau 403, iar Drive dă 200
pe același token (control). Contul e personal (gmail.com, fără hosted domain),
proiectul API-ului (`1068987308935`) e chiar proiectul clientului OAuth, iar
API-ul e activ. Regula oficială spune că din **31 martie 2025** acele scope-uri
au fost retrase: rămâne doar conținutul creat de aplicație.

Așadar, cerute `photoslibrary.readonly.appcreateddata` + `photoslibrary.edit.appcreateddata`
(32 scope-uri), iar uneltele Photos rescrise pe modelul real: `gphotos_list`,
`gphotos_albums`, `gphotos_create_album`, `gphotos_upload`, `gphotos_edit_item`.
Picker API **ne** legat: `sessions.create` cere un `pollingUri` pe care Google
însuși trebuie să-l ajungă - imposibil de la `127.0.0.1`. Documentat, nu
cosmetizat.

### 7.4 Cloud
Run `40479493605`: `SOURCE_COMMIT=3bd5420`, `CREDENTIAL_FIELDS` complete,
`scope_chars=1233`, `VERDICT=PASS`, 11 servicii cu date reale. Secretul merge:
corecția BOM (`sed '1s/^\xEF\xBB\xBF//' | tr -d '\r\n'`) a rezolvat
`base64: invalid input`.

### 7.5 Ascultătoare: 90/60 min -> **180 min**
Un răspuns uman nu trebuie să se piardă într-un timeout.

## 8. 27 oct 2026, 12:06-12:15 - consimțământul #3 și starea finală măsurată

### 8.1 Grant de 32 scope-uri
`CODE_RECEIVED=1` (12:06:54) -> `PROVISION_EXIT=0` -> `SCOPES=32` ->
`RESTART_EXIT=0` -> `PROBE_EXIT=0` -> `VERDICT=PASS`. Tokenul duce acum și
`photoslibrary.readonly.appcreateddata` + `photoslibrary.edit.appcreateddata`.

### 8.2 Proba pe 16 servicii - 13 OK
`identity`, `drive`, `gmail`, `calendar`, **`photos`**, `books`, `tasks`,
`apps-script`, `chat`, `contacts`, `youtube`, `docs`, `sheets` -> STATUS=OK cu
date reale. REFUSED, fiecare cu cauza măsurată:
- **keep** - 403: scope-ul nu există în registrul public de scope-uri Google
- **sites** - 404: API-ul a fost retras de Google
- **notebooklm** - `NO_EXTENDLM_TOKEN`: așteaptă autentificarea lui Popy pe
  extendlm.com

### 8.3 Photos: calea de scriere, probată fără să creeze nimic
API-ul Photos Library **nu are** `albums.delete` - un album creat se poate doar
redenumi sau depublicat. Un album de test ar fi fost gunoi permanent în
biblioteca lui Popy. Așadar proba s-a făcut cu un corp gol:
`POST /v1/albums` cu `{}` -> **400 „Request must have a title for the album."**
Dacă scope-ul ar fi lipsit, răspunsul ar fi fost 403. Deci 400 înseamnă că
autorizarea a trecut - și **nu s-a creat niciun album**.
`mediaItems.list` 200, `albums.list` 200, Drive 200 (control), `VERDICT=PASS`.

### 8.4 NotebookLM: nu există API public
Confirmat din două surse independente: directorul oficial Google
(`https://www.googleapis.com/discovery/v1/apis`) nu are nicio API `notebooklm`
- doar `notebooks` (Vertex AI) - iar `gcloud services list --available` nu
listează niciun serviciu NotebookLM. Deci ExtendLM e singurul drum prin MCP,
și e legat corect: client dinamic, PKCE S256, ascultător pe `127.0.0.1:8799`
cu fereastră de 180 de minute.

## 9. 27 oct 2026, 12:29-12:42 - NotebookLM a devenit LIVE

### 9.1 Loginul nu era pasul lipsă - autorizarea era
La 12:29 `data/extendlm.json` era **ABSENT**, iar portul `127.0.0.1:8799`
asculta în continuare. Diferența dintre „am făcut login" și „am autorizat" a
fost măsurată, nu ghicită: procesul ascultător (node
`extendlm-provision.mjs --port 8799`, pornit 11:37:14) ține `state` +
`code_verifier`; deschiderea URL-ului de autorizare produce callbackul cu
`code`. Loginul pe `extendlm.com` nu produce cod - doar îți permite să treci
de ecranul de consimțământ.

Rezultatul, măsurat:
- callbackul a ajuns: `http://127.0.0.1:8799/callback?code=…&state=…`, cu
  `state` **identic** cu cel ținut de procesul viu (valoarea nu se publică:
  e nonce de CSRF, consumat deja);
- `data/extendlm.json`: **1118 B**, scris la 12:33:24 - `token_len=87`,
  `refresh_token` prezent, `scope` 436 caractere, `obtained_at=2026-10-27T10:33:24Z`,
  `expires_at` = +3 h;
- portul `8799` s-a închis imediat după schimb (`server.close()`) - comportament
  corect, nu o cădere.

**Leție de măsurare:** taskul de fundal a fost raportat `status=lost` la 12:28,
dar procesul node a supraviețuit (măsurat la 12:29: `LISTENING pid=55620`,
pornit 11:37:14). *Task pierdut* ≠ *proces mort*. Verificarea s-a făcut pe
obiectul real (port + PID + command line), nu pe raportul tracker-ului.

### 9.2 DEFECT MĂSURAT: `notebooklm_ask` nu trimitea întrebarea
Cu tokenul prezent, unealta răspundea `HTTP=200` - dar **nu întreba nimic**:
implementarea făcea `initialize` + `tools/list` și returna lista de unelte
plus șirul întrebării. Era exact cazul pe care `docs/EXTENDLM.md` îl avertiza
(`## De ce notebooklm_ask trebuie să apeleze unelte reale`): o probă care
listează unelte poate trece cu un token mort, pentru că nu execută nimic.

Reparația, la sursă (`container/server.mjs`):
1. `list_notebook_users` -> `extension_connection` + `auth_user_id`
   (forma măsurată: `{connections:[{extension_connection, users:[{auth_user_id, is_selected}]}]}`);
2. `list_notebooks` -> primul notebook (forma măsurată: cheie **`items`**, câmp **`id`**);
3. `ask_notebook` -> întrebarea, cu răspunsul întors.

### 9.3 Starea măsurată a lanțului ExtendLM
| Măsurătoare | Valoare |
|---|---|
| `TOOL_COUNT` | **160** unelte |
| `TOOLS_HTTP` | 200 (`INIT_HTTP=400` - serverul e stateless, fără `mcp-session-id`) |
| `extension_status.connected` | **true** |
| contul selectat | `apvizual@gmail.com`, `auth_user_id=0`, `is_selected=true` |
| `get_notebooklm_capabilities` | `authenticated=true`, `tier=NOTEBOOKLM_TIER_PRO_CONSUMER_USER`, `notebook_limit=500`, `source_limit=300` |
| notebookuri vizibile | `JULES` (184 surse), `GEMINI & AI STUDIO` (251 surse), … |

**Corectură de drift:** `docs/EXTENDLM.md` lista ca „deschis" faptul că portul
9412 (profilul `minimax-notebooklm`) era închis. Măsurătoarea arată că aceasta
era o ipoteză greșită: extensia din Chrome-ul obișnuit al lui Popy **este
conectată** (`connected=true`). Portul 9412 e un profil local, nu canalul
extensiei.

### 9.4 Proba reală prin unealta reparată
`notebooklm_ask` cu întrebarea „In one short paragraph: what is this notebook
about, and what are its main sources?"` ->
`notebook_id=f7ea4298-8604-4df3-ab3f-a6d634d4cbc6`, `notebook_title=JULES`,
`answer_chars=8139`, `is_error=false`. Răspunsul e despre Google Jules, cu
numărul de surse și depozitele reale - nu un mesaj de eroare deghizat.

### 9.5 Bilanț: 14 OK / 2 REFUSED / 0 ERROR
`TALLY={"OK":14,"REFUSED":2,"ERROR":0,"SKIP":0}`, `VERDICT=PASS`, `PROBE_EXIT=0`.
`notebooklm` a trecut din REFUSED în OK. Rămân REFUSED doar cele două API-uri
retrase de Google: **keep** (403, scope inexistent) și **sites** (404, API
retiras).

Container: `google-access:1.0.7`, `running|healthy`, `grant=live`,
`reauth_required=false`, 30 unelte. Semnătura lui `/app/server.mjs` din imagine
e identică cu cea din repo (`c9605239322b420b…`) - `MATCH=True`.

### 9.6 DEFECT MĂSURAT: sync-ul ștergea regula `.work/` din `.gitignore`
`sync-container-source.py` scria `.gitignore` dintr-o constantă proprie care
nu conținea regula `.work/`. La rularea de după reparația serverului, regula a
dispărut din fișier, iar `git status` a expus o clonă de lucru a repo-ului
MAVIS-CLOUD (418 fișiere, 15 MB) - într-un repository **public**. Nu s-a
introdus nimic în istoric, pentru că poarta a oprit înainte de commit.

Reparația, la sursă: constanta conține acum regula completă, iar scriptul
**verifică** proprietatea reală în loc să o presupună:
- `git check-ignore` pentru `data/credentials.json`, `data/extendlm.json`,
  `.work/MAVIS-CLOUD/README.md`;
- `git ls-files` - nimic sub `data/`, `logs/`, `state/`, `.work/` să fie
  **urmărit** (o regulă de `.gitignore` nu scoate din index un fișier deja
  adăugat).

Falsificare pe copie: într-un repo-copy cu `data/credentials.json` adăugat forțat,
poarta a raportat `PROBLEMS=2` (`NOT_IGNORED` + `TRACKED_SENSITIVE_PATH`) și a
ieșit cu **2**; repo-ul real a rămas neatins. Pe repo-ul real:
`TRACKED_CHECK_OK files=79 sensitive=0`, `PROBLEMS=0`.

