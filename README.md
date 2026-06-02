# Test hodiny - sumarizace hodin

Tento repozitar slouzi jako jednoduche GitHub udelatko pro evidenci a sumarizaci hodin.

Od 1. 6. 2026 ma CEBES predplaceno 20 hodin mesicne na:

- upravy SW,
- telefonicke konzultace,
- jine sluzby dle dohody.

Pozadavky se resi podle aktualni vytizenosti programatoru. Standardni doba dodani je do 30 dnu.

Pokud soucet hodin v danem mesici prekroci 20 hodin, je potreba poslat samostatnou nabidku.

## Evidence hodin

Hodiny se zapisujou do souboru [hodiny.csv](hodiny.csv).

Sloupce:

- `datum` - datum prace ve formatu `YYYY-MM-DD`
- `zakaznik` - napr. `CEBES`
- `popis` - kratky popis prace
- `typ` - napr. `SW`, `konzultace`, `jine`
- `hodiny` - pocet hodin, muze byt `1.5` nebo `1,5`

Priklad:

```csv
datum,zakaznik,popis,typ,hodiny
2026-06-03,CEBES,Telefonicka konzultace,konzultace,1.5
2026-06-05,CEBES,Uprava exportu faktur,SW,3
```

## Spusteni sumarizace

```bash
python sumarizace.py
```

Vypise souhrn po mesicich:

```text
CEBES - 2026-06
Predplaceno: 20 h
Vycerpano: 5.0 h
Zbyva: 15.0 h
Stav: OK
```

Pro jeden konkretni mesic:

```bash
python sumarizace.py --mesic 2026-06
```

## Automaticky beh v GitHubu

GitHub Action v `.github/workflows/sumarizace.yml` spusti sumarizaci pri kazde zmene souboru `hodiny.csv` nebo skriptu `sumarizace.py`.

Vysledek bude videt v zalozce **Actions**.

## Otevreni jako stranka

V repozitari je taky jednoducha webova stranka v [index.html](index.html).

Po zapnuti GitHub Pages pujde otevrit primo v prohlizeci a ukaze:

- vycerpane hodiny ve vybranem mesici,
- kolik hodin zbyva z limitu 20 h,
- jestli je potreba poslat nabidku,
- jednotlive zaznamy z `hodiny.csv`.
- editor pro pridani, upravu a smazani zaznamu primo na strance.

Zapnuti v GitHubu:

1. Otevrit repozitar `test-hodiny`.
2. Jit do **Settings**.
3. Vlevo kliknout na **Pages**.
4. V casti **Build and deployment** vybrat:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/root**
5. Kliknout na **Save**.

GitHub pak ukaze odkaz na hotovou stranku.

## Pridani hodin na strance

Na strance je formular **Pridat hodiny**.

Po pridani radku se souhrn prepocita hned na strance.

Pokud je nastaveny GitHub token, zmena se rovnou commitne do `hodiny.csv` v repozitari.

Funguje to pro:

- **Pridat** - prida radek a ulozi do GitHubu,
- **Smazat** - smaze radek a ulozi do GitHubu,
- upravu existujiciho radku - po opusteni pole ulozi do GitHubu.

Bez tokenu se zmeny ukladaji jen lokalne v prohlizeci.

## GitHub token pro automaticke ukladani

GitHub Pages je staticka stranka, takze pro zapis do repozitare potrebuje GitHub token.

Doporucene nastaveni tokenu:

1. GitHub -> **Settings**.
2. **Developer settings**.
3. **Personal access tokens**.
4. **Fine-grained tokens**.
5. **Generate new token**.
6. Repository access: vybrat jen `test-hodiny`.
7. Permissions -> **Contents**: **Read and write**.
8. Na strance kliknout na ikonku **Nastaveni**.
9. Vygenerovany token vlozit do pole **GitHub token** a kliknout **Ulozit token**.

Token se uklada jen do prohlizece pres `localStorage`. Neni ulozeny v repozitari.

V nastaveni jsou taky servisni tlacitka **Stahnout CSV** a **Nacist z GitHubu**.
