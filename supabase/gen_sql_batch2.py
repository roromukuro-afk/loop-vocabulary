import json
import os

batches = [
    ("seed-eiken-pre2-b9.json", "supabase/tmp_pre2_b9.sql"),
    ("seed-eiken45-b9.json",    "supabase/tmp_e45_b9.sql"),
    ("seed-basic-daily-b7.json","supabase/tmp_daily_b7.sql"),
    ("seed-toeic-b14.json",     "supabase/tmp_toeic_b14.sql"),
    ("seed-eiken3-b9.json",     "supabase/tmp_e3_b9.sql"),
    ("seed-eiken1-b5.json",     "supabase/tmp_e1_b5.sql"),
    ("seed-highschool-b6.json", "supabase/tmp_hs_b6.sql"),
]

base = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(base)
data_dir = os.path.join(project_root, "src", "data")

for json_file, sql_out in batches:
    json_path = os.path.join(data_dir, json_file)
    sql_path = os.path.join(project_root, sql_out)
    with open(json_path, encoding="utf-8") as f:
        words = json.load(f)
    lines = []
    for w in words:
        mid = w["material_id"].replace("'", "''")
        word = w["word"].replace("'", "''")
        meaning = w["meaning"].replace("'", "''")
        pos = w.get("pos", "").replace("'", "''")
        level = w.get("level", "").replace("'", "''")
        imp = int(w.get("importance", 3))
        disp = int(w.get("display_order", 0))
        lines.append(
            f"INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)\n"
            f"SELECT '{mid}','{word}','{meaning}','{pos}','{level}',{imp},{disp}\n"
            f"WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='{mid}' AND word='{word}');"
        )
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Generated {sql_path} ({len(words)} words)")

print("Done.")
