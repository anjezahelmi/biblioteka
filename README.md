# 📚 Biblioteka Digjitale — Shkolla 9-vjeçare "Edith Durham", Tiranë

Aplikacion Node.js + PostgreSQL për bibliotekën online të shkollës.

## Si ta ndezësh

1. Sigurohu që PostgreSQL është i ndezur (shërbimi `postgresql-x64-18`).
2. Hap një terminal në këtë dosje dhe shkruaj:

```
npm start
```

3. Hap shfletuesin te **http://localhost:3000**

Databaza `libraria` krijohet vetë në PostgreSQL herën e parë (mund ta shohësh në pgAdmin).

## Llogaria e administratorit

- **Përdoruesi:** `admin`
- **Fjalëkalimi:** `admin123`

⚠️ Ndryshoje fjalëkalimin sa më parë (krijo një admin të ri te Paneli → Përdoruesit dhe fshi të vjetrin).

## Çfarë mundesh të bësh

**Si vizitor (pa llogari):**
- Shfleton, kërkon dhe lexon të gjithë librat lirisht

**Si nxënës/mësues (user):**
- Regjistrohesh vetë ose të krijon llogari admini
- Progresi i leximit të ruhet dhe të shfaqet "Vazhdo leximin"
- Kërkon libra sipas titullit, autorit ose kategorisë
- Lexon libra direkt në shfletues (PDF, EPUB, TXT, HTML)
- Progresi i leximit ruhet vetë — vazhdon aty ku e le
- Shkarkon librat

**Si administrator:**
- Ngarkon libra (PDF, EPUB, TXT, HTML) me kopertinë
- Sheh statistika: përdorues, libra, hyrje ditore, lexime
- Sheh të gjithë përdoruesit dhe historikun e hyrjeve (IP, shfletues, koha)
- Krijon e fshin përdorues dhe libra

## Cilësimet (.env)

| Variabla | Vlera aktuale |
|---|---|
| PORT | 3000 |
| PGUSER / PGPASSWORD | postgres / postgres |
| PGDATABASE | libraria |

## Librat fillestarë

- **Bagëti e Bujqësija** — Naim Frashëri (teksti i plotë nga Wikisource, domen publik)
- **Naim Frashëri (elegji)** — Andon Zako Çajupi (domen publik)
- **Edith Durham — Mbretëresha e Malësorëve** — broshurë njohëse e shkollës

Libra të tjerë shqip në domen publik mund t'i gjesh e shkarkosh nga:
- https://wikisource.org (kërko autorë si Naim Frashëri, Çajupi, Mjeda, Migjeni)
- https://www.gutenberg.org
pastaj i ngarkon te Paneli → Ngarko libër.
