import json, pathlib

base = pathlib.Path(__file__).parent.parent / "src" / "data"
out  = pathlib.Path(__file__).parent

files = [
    ("seed-toeic-b25.json",        "tmp_toeic_b25.sql"),
    ("seed-toeic-b26.json",        "tmp_toeic_b26.sql"),
    ("seed-eiken1-b13.json",       "tmp_e1_b13.sql"),
    ("seed-eiken1-b14.json",       "tmp_e1_b14.sql"),
    ("seed-eiken-pre2-b18.json",   "tmp_pre2_b18.sql"),
    ("seed-eiken-pre2-b19.json",   "tmp_pre2_b19.sql"),
    ("seed-eiken-pre2-b20.json",   "tmp_pre2_b20.sql"),
    ("seed-eiken-pre2-b21.json",   "tmp_pre2_b21.sql"),
    ("seed-eiken-pre2-b22.json",   "tmp_pre2_b22.sql"),
    ("seed-eiken-pre2-b23.json",   "tmp_pre2_b23.sql"),
    ("seed-eiken3-b17.json",       "tmp_e3_b17.sql"),
    ("seed-eiken3-b18.json",       "tmp_e3_b18.sql"),
    ("seed-eiken3-b19.json",       "tmp_e3_b19.sql"),
    ("seed-eiken45-b18.json",      "tmp_e45_b18.sql"),
    ("seed-eiken45-b19.json",      "tmp_e45_b19.sql"),
    ("seed-eiken45-b20.json",      "tmp_e45_b20.sql"),
    ("seed-eiken45-b21.json",      "tmp_e45_b21.sql"),
    ("seed-eiken45-b22.json",      "tmp_e45_b22.sql"),
    ("seed-basic-daily-b15.json",  "tmp_daily_b15.sql"),
    ("seed-basic-daily-b16.json",  "tmp_daily_b16.sql"),
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
