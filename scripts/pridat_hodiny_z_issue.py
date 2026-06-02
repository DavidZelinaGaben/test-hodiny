import csv
import os
import re
from datetime import datetime
from pathlib import Path


CSV_SOUBOR = Path("hodiny.csv")
POVOLENE_TYPY = {"SW", "konzultace", "jine"}
POVINNE_KLICE = ("datum", "zakaznik", "popis", "typ", "hodiny")


def hodnota(text: str, klic: str) -> str:
    shoda = re.search(rf"^{re.escape(klic)}:\s*(.+)$", text, re.MULTILINE)
    if not shoda:
        raise ValueError(f"Chybi hodnota: {klic}")
    return shoda.group(1).strip()


def nacti_zaznam() -> dict[str, str]:
    telo = os.environ.get("ISSUE_BODY", "")

    if "AUTO_HODINY_ZAZNAM" not in telo:
        raise ValueError("Issue neni zaznam hodin.")

    zaznam = {klic: hodnota(telo, klic) for klic in POVINNE_KLICE}

    datetime.strptime(zaznam["datum"], "%Y-%m-%d")

    hodiny = float(zaznam["hodiny"].replace(",", "."))
    if hodiny <= 0:
        raise ValueError("Hodiny musi byt vetsi nez 0.")
    zaznam["hodiny"] = str(hodiny).rstrip("0").rstrip(".")

    if zaznam["typ"] not in POVOLENE_TYPY:
        raise ValueError(f"Neznamy typ prace: {zaznam['typ']}")

    return zaznam


def pridej_do_csv(zaznam: dict[str, str]) -> None:
    soubor_existuje = CSV_SOUBOR.exists()

    with CSV_SOUBOR.open("a", newline="", encoding="utf-8") as soubor:
        writer = csv.DictWriter(soubor, fieldnames=POVINNE_KLICE)

        if not soubor_existuje:
            writer.writeheader()

        writer.writerow(zaznam)


def main() -> None:
    pridej_do_csv(nacti_zaznam())


if __name__ == "__main__":
    main()
