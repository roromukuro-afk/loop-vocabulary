import Database from 'better-sqlite3';
const path = process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data\\Default\\Network\\Cookies';
try {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  const rows = db.prepare("SELECT count(name) as cnt FROM cookies WHERE host_key LIKE '%note.com%'").all();
  console.log('成功:', rows[0].cnt, '件');
  db.close();
} catch(e) {
  console.log('失敗:', e.message);
}
