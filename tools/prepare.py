"""Build data.js for the demo page.

usage: python3 -I tools/prepare.py <uz_medical_facilities.geojson> <regions.json> <data.js with universities> <geoBoundaries UZB ADM1 geojson>

Inputs come from the medical facilities database (OpenStreetMap-based, ODbL), official population by region
(OCHA/UNFPA COD-PS, CC BY-IGO) and a registry of universities (CC0). Records whose name looks like a private
person's name are published without the name.
"""
import json
import re
import sys

FAC, REG, UNIS, GB = sys.argv[1:5]


def jsvar(path):
    s = open(path, encoding="utf-8").read()
    return json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))


REGION_RU = {"UZ-TK": "г. Ташкент", "UZ-TO": "Ташкентская обл.", "UZ-SA": "Самаркандская обл.", "UZ-BU": "Бухарская обл.", "UZ-AN": "Андижанская обл.",
             "UZ-FA": "Ферганская обл.", "UZ-NG": "Наманганская обл.", "UZ-QA": "Кашкадарьинская обл.", "UZ-SU": "Сурхандарьинская обл.", "UZ-JI": "Джизакская обл.",
             "UZ-SI": "Сырдарьинская обл.", "UZ-NW": "Навоийская обл.", "UZ-XO": "Хорезмская обл.", "UZ-QR": "Каракалпакстан"}

# Points that lie outside Uzbekistan (checked against the geoBoundaries ADM0 border and OSM reverse geocoding):
# Kyrgyzstan (Kara-Suu, Aravan, Kadamjay, Batken, Chatkal, Ala-Buka), Kazakhstan (Saryagash), Turkmenistan (Gubadag).
FOREIGN = {"UZM-E35A26A9D9", "UZM-F61260CE6B", "UZM-AEC8CD1A01", "UZM-FC488478F3", "UZM-5EAB9394D2", "UZM-46D3D7E944", "UZM-5441CE9333",
           "UZM-6B631E2647", "UZM-76190D0E34", "UZM-A8D1392CCD", "UZM-925FF39A49", "UZM-5B37D5F713", "UZM-9E2B56A7A7", "UZM-E1B3482D55",
           "UZM-12039B0633", "UZM-F7FD6322B4", "UZM-452BAB0FF7", "UZM-7F2BB18370", "UZM-C26EAE016D", "UZM-7C4D891FE0", "UZM-636E1F0A74"}
# Not places where patients are treated: pharmacies, opticians, morgue, forensic examination, veterinary clinic, folk healers.
NOT_CARE = {"UZM-2F82CE5CEC", "UZM-B66F491AB3", "UZM-22EA2E34F6", "UZM-26D5A0483D", "UZM-31CB7DC074", "UZM-07D1A46E23", "UZM-F81D8BE7DD",
            "UZM-47AAD2372D", "UZM-E8E7FAAA1C", "UZM-8B1FEE58FC", "UZM-5487ACB232", "UZM-C431E6E4E6", "UZM-C6FE0B7AB8", "UZM-63B1001616"}
# The same facility mapped twice within ~100 m; the copy with less information is dropped.
DUPLICATE = {"UZM-687A9EDB2D", "UZM-0E452C77E2", "UZM-95A96DE67C", "UZM-48D694B07E"}
SKIP = FOREIGN | NOT_CARE | DUPLICATE

g = json.load(open(FAC, encoding="utf-8"))
rows = []
for f in g["features"]:
    p = f["properties"]
    if p["uid"] in SKIP:
        continue
    lon, lat = f["geometry"]["coordinates"][:2]
    name = p.get("name_ru") or p.get("name") or p.get("name_latin") or ""
    if p.get("personal_name_flag"):
        name = ""
    langs = p.get("site_languages") or ""
    intl = p.get("intl_signals") or ""
    acc = p.get("accreditation") or ""
    ready_now = bool(re.search(r"работа с иностранцами", intl)) or bool(acc) or ("en" in langs.split(";"))
    phone = (p.get("phones") or "").split(";")[0].strip()
    rows.append([
        p["uid"], name, p.get("facility_type_ru") or "", p.get("facility_type") or "", p.get("ownership") or "", p.get("region_code") or "",
        p.get("district") or "", p.get("street") or "", round(lat, 5), round(lon, 5), p.get("specialties") or "", phone, p.get("website") or "",
        langs, intl, acc, 1 if str(p.get("prices_on_site")) == "True" else 0, int(p.get("readiness_score") or 0), p.get("opening_hours") or "",
        p.get("source_url") or "", 1 if ready_now else 0,
    ])

# population by region (UZ, 2018)
R = json.load(open(REG, encoding="utf-8"))
pop = {r["iso"]: r["demographics"].get("population") for r in R["regions"] if r["country"] == "UZ"}

# medical universities by region (point in polygon)
polys = []
for feat in json.load(open(GB, encoding="utf-8"))["features"]:
    nm = feat["properties"]["shapeName"]
    gm = feat["geometry"]
    polys.append((nm, gm["coordinates"] if gm["type"] == "MultiPolygon" else [gm["coordinates"]]))
GBMAP = {"Andijan Region": "UZ-AN", "Namangan Region": "UZ-NG", "Fergana Region": "UZ-FA", "Republic of Karakalpakstan": "UZ-QR", "Xorazm Region": "UZ-XO",
         "Navoiy Region": "UZ-NW", "Surxondaryo Region": "UZ-SU", "Samarqand Region": "UZ-SA", "Tashkent Region": "UZ-TO", "Sirdaryo Region": "UZ-SI",
         "Jizzakh Region": "UZ-JI", "Bukhara Region": "UZ-BU", "Qashqadaryo Region": "UZ-QA", "Tashkent": "UZ-TK"}


def inside(x, y, ring):
    c = False
    for i in range(len(ring)):
        x1, y1 = ring[i][:2]; x2, y2 = ring[i - 1][:2]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def region_of(lon, lat):
    for nm, ps in polys:
        for poly in ps:
            if inside(lon, lat, poly[0]) and not any(inside(lon, lat, hole) for hole in poly[1:]):
                return GBMAP[nm]
    return None


MED = re.compile(r"medic|tibbiyot|pharm|farmats|медицин|фарм|pediatr|stomatolog|dental", re.I)
D = jsvar(UNIS)
med_unis = []
for u in D["unis"]:
    if u[2] != "UZ":
        continue
    names = " ".join(str(x) for x in (u[1], u[8], u[9]))
    if MED.search(names) and not re.search(r"veterin|ветеринар", names, re.I):
        reg = "UZ-TK" if re.match(r"(?i)^(tashkent|ташкент|toshkent)$", (u[5] or "").strip()) else region_of(u[4], u[3])
        med_unis.append({"name": u[8] or u[1], "region": reg, "works": u[6], "lat": u[3], "lon": u[4]})

out = {"facilities": rows, "regions": REGION_RU, "population": pop, "medUnis": med_unis,
       "cols": ["uid", "name", "type", "typeCode", "ownership", "region", "district", "street", "lat", "lon", "specialties", "phone", "website",
                "siteLangs", "intl", "accreditation", "prices", "readiness", "hours", "source", "readyNow"]}
open("data.js", "w", encoding="utf-8").write("window.MED=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";")
print(len(rows), "facilities;", sum(r[-1] for r in rows), "ready now;", len(med_unis), "medical universities")
