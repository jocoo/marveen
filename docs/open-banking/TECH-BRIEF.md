# Open Banking Tech Brief (Basiq + alternatíva)

Kanban #1 (356abf88) unblock-input -> Yzma decision matrix-ának.
Kanban #62 (8054608e) / Kronk / 2026-06-27

## TL;DR

Egy felhasználós, saját pénz monitoring use case-re javaslat: **Basiq sandbox
regisztráció elsőként**. Olcsó (free tier), jó developer experience, magyarázó
docs, és a teljes connect-flow kipróbálható mock-bankkal mielőtt prod ADR-rel
kell foglalkozni. Adatree-t csak akkor érdemes újra elővenni, ha kiderül hogy
a Basiq kommerciális ToS / Affiliate model egy non-business single-user
setup-ra túl sok overhead-et hoz be.

A CDR (Consumer Data Right) accreditation maga az igazi gátló: ADR vagy
Affiliate státusz nélkül semelyik aggregátorhoz NEM lehet prod-on bekötni
NAB / ING adatot. Basiq sandbox-on ez nem releváns, ott fake-bank-on
tesztelünk.

Fontos: az alábbi adatok 2026.01 körüli ismeretek. Mielőtt Yzma sign-off-ot
ad, a Basiq aktuális pricing / tier / sandbox-policy oldalát ellenőrizni
kell - a CDR rules és a Basiq commercial conditions évente módosulnak.

## 1. Basiq auth model

| Komponens | Hogy működik |
| --- | --- |
| Aggregator szerep | Basiq az **ADR** (Accredited Data Recipient), mi NEM vagyunk ADR. Affiliate / TSP modellben a mi platformunk Basiq alá kapcsolódik. |
| Consent flow | Basiq hosted Connect UI (vagy Connect SDK). A user-t a Basiq oldalára redirect-eljük; ott azonosítja magát a banknál (NAB / ING saját login UI), aláírja a CDR consent-et, visszatér hozzánk. Bank-credentials soha nem mennek át a mi szerverünkön. |
| Server auth | Basiq Server API: `client_credentials` grant a Basiq API-kulccsal, access token 60 perces TTL, refresh server-side. |
| User token | Basiq userId-hoz kötött scope-os token, ezzel olvasunk a tranzakciókat. |

CDR accreditation pragmatika (single-user / saját pénz):

- Az "Affiliate" modell egy software platform-ra van szabva, ahol mi nyújtunk
  szolgáltatást más AU end-user-eknek. Egyszemélyes use case-re ez túl
  formális; Basiq-nek van **CDR Insights / Trial / Personal** tier-szerű
  ajánlata, ami non-production scope-on engedi a sandbox + limited prod
  hozzáférést.
- Sandbox-hoz: csak Basiq fiók kell, **CDR accreditation nem szükséges**.
  Innen indulunk.
- Prod-hoz (NAB / ING valódi adat): Basiq commercial agreement + Affiliate
  ki-confirmation. Ez a tényleges blocker, nem a sandbox.

Mit kell nekünk tárolni (állandó perzisztens állapot):

| Mező | Forrás | Tárolás |
| --- | --- | --- |
| Basiq `userId` | Basiq POST /users | per-Jocoo egyszer, env / config |
| Connection-id (NAB) | Basiq Connect callback | DB tábla `basiq_connections` |
| Connection-id (ING) | Basiq Connect callback | ugyanaz |
| Consent expiry | Basiq Connect callback `expires` | DB, watcher cron a lejáratra |
| Server access token | client_credentials response | RAM cache (60 perces TTL) |

Mit tárol Basiq (és így mi NEM): bank-credentials, raw transaction cache,
CDR consent record, ADR audit log.

## 2. API surface

Releváns endpoint-ok a brief scope-jához:

| Cél | Endpoint | Megjegyzés |
| --- | --- | --- |
| Account list + balance | `GET /users/{id}/accounts` | `currentBalance` + `availableBalance` mező |
| Tranzakció list | `GET /users/{id}/transactions?filter=...` | Lapozható; `status: pending\|posted` |
| Connection refresh | `POST /users/{id}/connections/{cid}/refresh` | On-demand pull, tier-függő rate-limit |
| Consent renew | Basiq Connect UI re-trigger | Lejárat előtt 30 nappal javasolt |

Pending vs settled distinction:

- Basiq normalizált modell: `status` = `pending` vagy `posted`.
- NAB / ING bankok különbözőképpen jelzik a "függőben" tranzakciókat (NAB
  napi posting batch, ING merchant-time vs settlement-time). A normalizálást
  Basiq elintézi - **ezt sandbox-on nem lehet validálni**, prod-on derül ki
  hogy mennyire pontos.

Multi-bank consent:

- **Bankonként külön CDR consent**. NAB egy ADR-consent, ING egy másik.
- Egy Basiq user-en BELÜL viszont több `connection` lehet -> nekünk egy
  userId és két connection-id (NAB + ING).
- A Basiq Connect Hosted UI a flow-t egy felületen viszi végig, a user egy
  session-ben mindkét bankot bekapcsolhatja, csak a bank-login UI vált.

## 3. Data freshness vs polling

| Bank | Update igény (Jocoo spec) | Polling stratégia |
| --- | --- | --- |
| NAB | napi tranzakció update | Cron `0 5 * * *` (helyi 5:00) -> connection refresh + tranzakció-fetch a legutóbbi 48h-ra |
| ING | heti, hétfő este | Cron `0 21 * * 1` (hétfő 21:00 Australia/Cairns) -> refresh + tranzakció-fetch a legutóbbi 9 napra |

Push alternatíva: Basiq webhook (`transaction.created`, `account.updated`,
`connection.disabled`) - ha tier-en elérhető és NAB / ING bankra konfigurálva
van, ez kiváltja a cron-t és lényegesen alacsonyabb költség.

Rate-limit-ek:

- Basiq API default 100 req/min (server token), paid tier-en emelt.
- `connection refresh` per-tier korlátozott (free tier napi limit-tel). NAB
  napi 1 refresh + ING heti 1 refresh **bőven** fér a free tier alá.
- A bank-oldali CDR rate-limit-eket Basiq absorbeálja; mi a Basiq API rate
  limit-jét látjuk.

Polling-pricing trade-off (Basiq tier-függő, ellenőrizni kell az aktuális
pricing oldalt): a single-user use case-re a heti ~8-10 refresh hívás free
tier-en belül marad.

## 4. CDR compliance overhead (dev-perspektíva)

| Követelmény | Implementáció |
| --- | --- |
| Audit log: consent | `consent_id`, `granted_at`, `scopes`, `expires_at` minden consent-create/update/revoke event-re. |
| Audit log: data access | API call timestamp + `purpose` code + Basiq endpoint, append-only. |
| Data deletion on consent end | `connection.disabled` webhook + scheduled job ami a `expires_at < now()` connection-ek adatát kitörli (CDR Rule 4.16A). |
| Consent renewal flow | Lejárat előtt 30 nappal user prompt + Basiq Connect re-trigger. |

Token lifecycle:

| Token | TTL | Renewal |
| --- | --- | --- |
| Basiq server token | 60 perc | `client_credentials` minden lejáratkor |
| Basiq user token | scope-ed (jellemzően 1 óra) | server side refresh |
| CDR consent | max 12 hónap (Basiq UI tipikusan 6-12 hónap) | re-consent Basiq Connect UI-n |

Revocation handling:

- Webhook `connection.disabled` event -> handler törli a connection-id-t a
  DB-ből és STOP-ol minden további refresh cron-t arra a connection-re.
- Fallback poll: ha a webhook lemarad, a következő cron `403` / `consent
  revoked` választ ad - ezt is connection-disabled state-be kell konvertálni.

## 5. Sandbox vs prod különbség

| Dimenzió | Sandbox | Prod |
| --- | --- | --- |
| Bank | mock bank ("Hooli Bank" + variánsok), tesztelhető NAB UI mock | valódi NAB és ING ADR endpoint |
| Credentials | fix demo user / pwd | valódi banki login |
| Tranzakciók | szintetikus, ismétlődő | valós; `pending` -> `posted` lifecycle |
| Connect flow | teljes (consent UI + redirect) | ugyanaz |
| CDR accreditation | NEM kell | KELL (Affiliate / TSP) |
| Costing | free | tier-függő |

**Implication**: a teljes connect-flow + consent-handling + DB-séma +
webhook-handler kipróbálható sandbox-on. Csak a NAB-specifikus tranzakció
szemantika (pending/settled timing, description normalizálás) nem
validálható prod nélkül.

## 6. Adatree összehasonlítás

| Dimenzió | Basiq | Adatree |
| --- | --- | --- |
| Modell | SDK-first aggregator, API-fókuszú | CDR data infrastructure, B2B integrátor partnerekkel dolgozik |
| Sandbox | self-serve, free fiókkal azonnal | partner-onboarding-os, hosszabb gate |
| DX (docs, SDK) | erős (Connect SDK, dashboard, kód-példák) | gyengébb, partneren keresztül |
| Pricing | tier-based (free + paid) | per-data-call / per-consent, drágább kis volumen-ben |
| Bank coverage AU | Big4 + ING + middle | hasonló |
| ADR / accreditation | sandbox-hoz nem kell | sandbox-hoz is jellemzően partner-szerződés |
| Single-user use case-re fit | jó | overkill |

## 7. Ajánlás

**Basiq sandbox-szal indulj, Adatree-t most ne**. Indok: single-user saját
pénz monitoring-ra a Basiq self-serve sandbox-fiók napokkal előbb ad
end-to-end teszteléshez flow-t, és a CDR Affiliate kérdés csak a prod
átállásnál esedékes - addigra már látjuk a kódot is.

## Mit teszünk a sandbox után (információ Yzma-nak, NEM most-feladat)

| Lépcső | Mit kell | Becsült idő |
| --- | --- | --- |
| 1. Basiq fiók + sandbox API kulcs | self-serve | 1 nap |
| 2. Connect flow POC: Hooli Bank + 1 csatorna | dev | 2-3 nap |
| 3. DB-séma + webhook handler + audit log | dev | 2-3 nap |
| 4. NAB / ING prod connect (CDR Affiliate confirm + commercial agreement Basiq-kel) | Jocoo + Basiq commercial | 2-6 hét, Basiq-en múlik |
| 5. Prod smoke + napi/heti cron | dev | 1-2 nap |

A 4. lépcső a fő üzleti / időkockázat - ezt Yzma decision matrix-ának
explicit jelölnie kell.

## Nyitott kérdések Yzma-nak

1. Jocoo single-user use case-re mit ajánl Basiq commercial team? (sandbox
   regisztráció után megkérdezhető)
2. Webhook elérhető-e free tier-en mindkét bankra? (Basiq tier-doksi)
3. ING heti push esetén lehet-e `transaction.created` webhook-ra építeni a
   cron helyett?
4. Adatree-nek van-e self-serve sandbox 2026 elejére? (ha igen, B-terv)
