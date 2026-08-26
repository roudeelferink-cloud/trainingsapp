# De app zelf hosten op hengelo-pi

De app stond op GitHub Pages. Dat kan niet meer: het adviesblok praat met de Claude-API,
en een sleutel in een browserbundel is een sleutel die op straat ligt — alles wat een
browser kan uitvoeren kan een bezoeker lezen. Daarom draait de app nu op de Pi, met een
servertje ernaast dat de sleutel vasthoudt, en komt hij via `tailscale serve` je tailnet
op.

Wat er draait:

```
telefoon ──tailscale──► hengelo-pi ──► 127.0.0.1:8097 (nginx, container `web`)
                                          ├── /            de app, statisch uit dist/
                                          └── /api/  ────► container `api`, poort 8098
                                                              └── Claude-API
```

Twee containers, één compose-project, één poort. Die poort staat op `127.0.0.1`, dus
zonder `tailscale serve` is er van buiten de Pi niets te bereiken — ook niet vanaf het
wifi thuis.

---

## Wat jij met de hand moet doen

Vier dingen. De rest staat in de repo.

### 1. De sleutel in `server/.env`

```bash
cd ~/trainingsapp/server
cp .env.example .env
nano .env          # ANTHROPIC_API_KEY=...
```

Maak in je Anthropic-account een **nieuwe** sleutel met het label `trainingsapp`. Niet
die van de nieuws-poller of van `~/trainingsreview` hergebruiken: los intrekbaar, en je
ziet per project wat het kost.

`.env` staat in `.gitignore` en hoort daar te blijven. `docker compose` leest het bestand
rechtstreeks (`env_file`), dus na het invullen is een `docker compose up -d` genoeg.

Zonder sleutel start alles gewoon; `/api/review` geeft dan `503` en het adviesblok in de
app blijft leeg. De app zelf werkt volledig — alle guardrails zijn lokaal.

### 2. Starten

```bash
cd ~/trainingsapp
docker compose up -d --build
docker compose ps            # allebei 'healthy'
curl -s http://127.0.0.1:8097/ -o /dev/null -w '%{http_code}\n'   # 200
```

De eerste build duurt op de Pi een minuut of vijf; daarna zit het meeste in de cache.

### 3. `tailscale serve` aanzetten

Dit is het enige commando dat je als root moet draaien, en het enige dat de app buiten de
Pi bereikbaar maakt:

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:8097
sudo tailscale serve status
```

Daarna staat de app op `https://hengelo-pi.<jouw-tailnet>.ts.net/`. Het exacte adres
staat in de uitvoer van `tailscale serve status`; `tailscale status` geeft de naam van je
tailnet.

Dat het **https** is, is geen luxe: een service worker registreert alleen in een secure
context. Zonder HTTPS laadt de app wel, maar is hij niet installeerbaar en werkt hij niet
offline — precies wat je in de sportschool nodig hebt.

Weer uitzetten:

```bash
sudo tailscale serve --https=443 off
```

### 4. De ACL zodat Anouc's toestel er alleen bij deze poort kan

Standaard mag in een tailnet iedereen bij alles. Dat is hier te ruim: Anouc's telefoon
hoort bij de trainingsapp te kunnen, en niet bij SSH, jarvis (8095), trace (8000) of de
edge-stack.

Zet dit in de ACL-editor (`login.tailscale.com` → **Access controls**). Vul de e-mail­adressen
in die bij de toestellen horen.

```jsonc
{
  "tagOwners": {
    "tag:trainingsapp": ["autogroup:admin"]
  },

  "acls": [
    // Jij houdt volledige toegang tot je eigen apparaten.
    {
      "action": "accept",
      "src": ["jouw-account@voorbeeld.nl"],
      "dst": ["*:*"]
    },

    // Anouc mag uitsluitend de trainingsapp op hengelo-pi, en uitsluitend via https.
    // 443 is de poort waar `tailscale serve` op luistert; 8097 staat op 127.0.0.1 en is
    // vanaf het tailnet sowieso niet te bereiken.
    {
      "action": "accept",
      "src": ["anouc@voorbeeld.nl"],
      "dst": ["hengelo-pi:443"]
    }
  ],

  "ssh": [
    // SSH blijft van jou alleen; Anouc staat hier bewust niet bij.
    {
      "action": "check",
      "src": ["autogroup:member"],
      "dst": ["autogroup:self"],
      "users": ["autogroup:nonroot", "root"]
    }
  ]
}
```

Let op twee dingen:

- **De ACL-editor keurt af wat niet klopt.** Verkeerd adres, en hij slaat niet op. Test
  daarna met **Access rules** (de preview in de editor): kies Anouc als bron en
  `hengelo-pi:22` als bestemming — die hoort geweigerd te worden.
- **Anouc's toestel moet in het tailnet zitten.** Uitnodigen via **Users → Invite
  external users**, of via een gedeeld account. Zonder dat is er niets om een regel op te
  hangen.

---

## De app op je telefoon zetten

1. Open `https://hengelo-pi.<tailnet>.ts.net/` in Safari of Chrome, met Tailscale aan.
2. *Deel → Zet op beginscherm*.
3. Daarna start hij als losse app en werkt hij offline.

**Het oude adres is een ander adres.** Voor de browser is `hengelo-pi.…ts.net` een andere
origin dan `…github.io`, en `localStorage` hoort bij de origin. De app op het nieuwe adres
begint dus leeg. Overzetten gaat in twee stappen:

1. Op het **oude** adres: *Instellingen → Exporteer alles*. Bewaar het JSON-bestand.
2. Op het **nieuwe** adres: *Instellingen → Importeer* en kies dat bestand.

Alles komt mee: historie, streefgewichten, check-ins, dagchecks, losse activiteiten,
afwijkingen, de pincode en beide profielen. Dat pad staat vast in
`tests/overzetten.test.ts`, met een echte export van de Pages-versie als invoer.

> Doe dit vóórdat je de oude versie van je beginscherm gooit. Zolang beide adressen nog
> werken kun je het rustig nog een keer doen.

---

## Bijwerken

```bash
cd ~/trainingsapp
git pull
docker compose up -d --build
```

De service worker haalt de nieuwe versie vanzelf op (`autoUpdate`); hij is actief nadat
je de app sluit en opnieuw opent.

## Kijken wat er gebeurt

```bash
docker compose logs -f api      # één regel per advies, plus de fouten
docker compose logs -f web      # de nginx-toegangslog
docker compose ps               # gezondheid van beide containers
```

De dagcache staat op een volume:

```bash
docker run --rm -v trainingsapp_trainingsapp-review:/data alpine cat /data/reviews.json
```

Daar staat per profiel het advies van vandaag en hoe vaak er die dag geprobeerd is. Weg
gooien mag altijd — dan haalt de app morgen (of na een herstart van de container, zodra
het bestand leeg is) gewoon een nieuw advies.

## Poorten op deze Pi

| Poort | Wat | Bereikbaar |
| --- | --- | --- |
| 8097 | trainingsapp (nginx) | alleen 127.0.0.1, via `tailscale serve` op 443 |
| 8098 | review-endpoint | alleen binnen het compose-netwerk |
| 8095 | jarvis | ongewijzigd |
| 8091 | voetbal | ongewijzigd |
| 8000 | trace | ongewijzigd |

De trainingsapp deelt niets met die andere stacks: eigen compose-project, eigen netwerk,
eigen volume, eigen `.env`.

## En `~/trainingsreview`?

Die repo blijft staan maar wordt niet meer gebruikt: de wekelijkse review per mail is
vervangen door het adviesblok in de app zelf. Er staat op deze Pi **geen** systemd-timer
voor geïnstalleerd (gecontroleerd met `systemctl --user list-unit-files` en
`/etc/systemd/system`), dus er valt niets uit te zetten. Was hij er ooit wel:

```bash
systemctl --user disable --now trainingsreview.timer
```

De SendGrid-sleutel in `~/trainingsreview/.env` doet nu niets meer. Intrekken kan geen
kwaad.

## Als het niet werkt

| Wat je ziet | Waar het meestal aan ligt |
| --- | --- |
| Geen adviesblok, verder werkt alles | Geen sleutel, of de Pi is niet bereikbaar. Dat is opzet: het blok zwijgt, de app niet. |
| `503` op `/api/review` | `ANTHROPIC_API_KEY` staat niet in `server/.env`, of de container is niet herstart na het invullen. |
| `502` op `/api/review` | De Pi kan de Claude-API niet bereiken, of het antwoord was onbruikbaar. `docker compose logs api` zegt welke van de twee. |
| `429` op `/api/review` | Vandaag al drie keer geprobeerd voor dit profiel. Morgen weer; dat is de rem op de kosten. |
| App laadt niet vanaf de telefoon | Tailscale uit, of `tailscale serve` staat niet aan. `sudo tailscale serve status`. |
| Wel te openen, niet te installeren | Je gebruikt `http://` of een IP-adres in plaats van de `ts.net`-naam. Een service worker vraagt HTTPS. |
| Anouc komt er niet in | Haar toestel zit niet in het tailnet, of de ACL laat `hengelo-pi:443` niet toe. |
