import json, pathlib, re

base = pathlib.Path(__file__).parent.parent / "src" / "data"
out  = pathlib.Path(__file__).parent

files = [
    ("seed-highschool-b8.json",    "tmp_hs_b8.sql"),
    ("seed-toeic-b16.json",        "tmp_toeic_b16.sql"),
    ("seed-eiken-pre2-b11.json",   "tmp_pre2_b11.sql"),
    ("seed-eiken45-b11.json",      "tmp_e45_b11.sql"),
    ("seed-eiken3-b11.json",       "tmp_e3_b11.sql"),
    ("seed-basic-daily-b9.json",   "tmp_daily_b9.sql"),
    ("seed-eiken1-b7.json",        "tmp_e1_b7.sql"),
]

def esc(s):
    return str(s).replace("'", "''")

for src, dst in files:
    words = json.loads((base / src).read_text(encoding="utf-8"))
    lines = ["BEGIN;"]
    for w in words:
        mid  = esc(w["material_id"])
        word = esc(w["word"])
        meaning = esc(w["meaning"])
        pos  = esc(w.get("pos",""))
        level = esc(w.get("level",""))
        imp  = int(w.get("importance", 3))
        disp = int(w.get("display_order", 0))
        lines.append(
            f"INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)\n"
            f"SELECT '{mid}','{word}','{meaning}','{pos}','{level}',{imp},{disp}\n"
            f"WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='{mid}' AND word='{word}');"
        )
    lines.append("COMMIT;")
    (out / dst).write_text("\n".join(lines), encoding="utf-8")
    print(f"Generated {dst} ({len(words)} rows)")
