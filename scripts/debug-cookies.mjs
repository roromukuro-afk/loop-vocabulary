import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createDecipheriv } from "crypto";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEMP + "\\chrome_cookies_final.db";

// AES key
const ps1 = join(__dirname, "get-chrome-aeskey.ps1");
const b64 = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`, { encoding: "utf8" }).trim();
const aesKey = Buffer.from(b64, "base64");
console.log("AES key:", b64.slice(0, 20) + "...", "len:", aesKey.length);

const db = new Database(TMP, { readonly: true });
const rows = db.prepare("SELECT name, encrypted_value, host_key FROM cookies WHERE host_key LIKE '%note.com%'").all();
db.close();

console.log(`\nCookies: ${rows.length}件`);
for (const row of rows) {
  const enc = Buffer.from(row.encrypted_value);
  const prefix = enc.length >= 3 ? enc.slice(0, 3).toString() : "---";
  const hex3 = enc.slice(0, 6).toString("hex");
  console.log(`  [${row.name}] domain=${row.host_key} len=${enc.length} prefix="${prefix}" hex=${hex3}`);

  if (prefix === "v10" || prefix === "v11") {
    const iv  = enc.slice(3, 15);
    const tag = enc.slice(enc.length - 16);
    const ct  = enc.slice(15, enc.length - 16);
    try {
      const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
      decipher.setAuthTag(tag);
      const val = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
      console.log(`    → 復号成功: ${val.slice(0, 40)}`);
    } catch(e) {
      console.log(`    → 復号失敗: ${e.message}`);
    }
  }
}
