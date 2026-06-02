import argparse
import csv
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


LIMIT_HODIN = 20.0
VYCHOZI_SOUBOR = Path("hodiny.csv")


@dataclass(frozen=True)
class Zaznam:
    datum: datetime
    zakaznik: str
    popis: str
    typ: str
    hodiny: float

    @property
    def mesic(self) -> str:
        return self.datum.strftime("%Y-%m")


def nacti_hodiny(cesta: Path) -> list[Zaznam]:
    if not cesta.exists():
        raise FileNotFoundError(f"Soubor {cesta} neexistuje.")

    zaznamy: list[Zaznam] = []

    with cesta.open(newline="", encoding="utf-8-sig") as soubor:
        reader = csv.DictReader(soubor)
        povinne_sloupce = {"datum", "zakaznik", "popis", "typ", "hodiny"}

        if not reader.fieldnames or not povinne_sloupce.issubset(reader.fieldnames):
            raise ValueError(
                "CSV musi obsahovat sloupce: datum, zakaznik, popis, typ, hodiny."
            )

        for cislo_radku, radek in enumerate(reader, start=2):
            try:
                datum = datetime.strptime(radek["datum"].strip(), "%Y-%m-%d")
                hodiny = float(radek["hodiny"].strip().replace(",", "."))
            except (AttributeError, ValueError) as chyba:
                raise ValueError(f"Chyba na radku {cislo_radku}: {chyba}") from chyba

            zaznamy.append(
                Zaznam(
                    datum=datum,
                    zakaznik=radek["zakaznik"].strip(),
                    popis=radek["popis"].strip(),
                    typ=radek["typ"].strip(),
                    hodiny=hodiny,
                )
            )

    return zaznamy


def secti_po_mesicich(zaznamy: list[Zaznam]) -> dict[str, float]:
    soucty: dict[str, float] = defaultdict(float)

    for zaznam in zaznamy:
        soucty[zaznam.mesic] += zaznam.hodiny

    return dict(sorted(soucty.items()))


def format_hodin(hodiny: float) -> str:
    return f"{hodiny:.2f}".rstrip("0").rstrip(".")


def vypis_souhrn(soucty: dict[str, float], mesic: str | None = None) -> int:
    vybrane_soucty = {
        aktualni_mesic: celkem
        for aktualni_mesic, celkem in soucty.items()
        if mesic is None or aktualni_mesic == mesic
    }

    if not vybrane_soucty:
        print("Pro zadany mesic nejsou zadne hodiny.")
        return 0

    prekroceno = False

    for aktualni_mesic, celkem in vybrane_soucty.items():
        zbyva = LIMIT_HODIN - celkem
        print(f"\nCEBES - {aktualni_mesic}")
        print(f"Predplaceno: {format_hodin(LIMIT_HODIN)} h")
        print(f"Vycerpano: {format_hodin(celkem)} h")

        if zbyva >= 0:
            print(f"Zbyva: {format_hodin(zbyva)} h")
            print("Stav: OK")
        else:
            prekroceno = True
            print(f"Prekroceno: {format_hodin(abs(zbyva))} h")
            print("Stav: poslat nabidku")

    return 1 if prekroceno else 0


def vytvor_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Secte odpracovane hodiny podle mesicu a ohlida limit 20 h."
    )
    parser.add_argument(
        "--soubor",
        type=Path,
        default=VYCHOZI_SOUBOR,
        help="Cesta k CSV souboru s hodinami.",
    )
    parser.add_argument(
        "--mesic",
        help="Volitelny filtr mesice ve formatu YYYY-MM, napr. 2026-06.",
    )
    return parser


def main() -> int:
    parser = vytvor_parser()
    args = parser.parse_args()

    if args.mesic:
        try:
            datetime.strptime(args.mesic, "%Y-%m")
        except ValueError:
            parser.error("--mesic musi byt ve formatu YYYY-MM.")

    zaznamy = nacti_hodiny(args.soubor)
    soucty = secti_po_mesicich(zaznamy)
    return vypis_souhrn(soucty, args.mesic)


if __name__ == "__main__":
    raise SystemExit(main())
