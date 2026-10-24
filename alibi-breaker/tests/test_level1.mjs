// Test Level 1 Alibi Breaker — validasi data kasus + syntax script.
// Bukan test browser: tidak membaca console browser, tidak menguji feel HP.
// Jalankan: node tests/test_level1.mjs  (dari folder alibi-breaker)
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(dir, "..", "index.html");
const html = readFileSync(htmlPath, "utf8");

let pass = 0;
function check(name, cond, extra = "") {
  if (!cond) { console.error("FAIL: " + name + " " + extra); process.exitCode = 1; }
  else { pass++; console.log("PASS: " + name); }
}

// 1. Syntax: ekstrak <script> dan jalankan node --check
const m = html.match(/<script>([\s\S]*?)<\/script>/);
check("script block ditemukan", !!m);
if (m) {
  writeFileSync("/tmp/ab_level1_script.js", m[1]);
  try { execSync("node --check /tmp/ab_level1_script.js", { stdio: "pipe" }); check("node --check script lolos", true); }
  catch (e) { check("node --check script lolos", false, String(e.message)); }
}

// 2. Ekstrak objek CASE dengan pencocokan kurung (string di CASE tidak mengandung { atau })
const start = html.indexOf("const CASE = {");
check("CASE ditemukan di index.html", start >= 0);
let CASE = null;
if (start >= 0) {
  const objStart = html.indexOf("{", start);
  let depth = 0, inStr = null, esc = false, end = -1;
  for (let i = objStart; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  check("CASE tertutup dengan benar", end > objStart);
  if (end > objStart) CASE = new Function("return (" + html.slice(objStart, end + 1) + ")")();
}

if (CASE) {
  check("pelaku = Lina (sesuai DESIGN §5.1)", CASE.culprit === "Lina");
  check("breakingClue = akses", CASE.breakingClue === "akses");
  const breaking = CASE.clues.find((c) => c.id === CASE.breakingClue);
  check("clue pematah ada dan mematahkan pelaku", !!breaking && breaking.breaks === CASE.culprit);
  check("jumlah tersangka = 4", CASE.suspects.length === 4);
  check("jumlah clue = 5", CASE.clues.length === 5);
  check("id tersangka unik", new Set(CASE.suspects.map((s) => s.id)).size === 4);
  check("id clue unik", new Set(CASE.clues.map((c) => c.id)).size === 5);
  // Setiap non-pelaku punya minimal satu clue pembela (clears)
  for (const s of CASE.suspects) {
    if (s.id === CASE.culprit) continue;
    const def = CASE.clues.find((c) => c.clears === s.id);
    check("non-pelaku " + s.id + " punya clue pembela", !!def);
    check("tersangka " + s.id + " punya teks defense", !!(s.defense_id && s.defense_en));
  }
  // Clue pendukung bukan pematah
  const sup = CASE.clues.find((c) => c.id === "sidik");
  check("sidik = pendukung, bukan pematah", !!sup && sup.supporting === true && sup.breaks === null);
  // Hint tidak menyebut nama pelaku
  check("jumlah hint = 2", CASE.hints.length === 2);
  check("hint tidak menyebut Lina", !CASE.hints.some((h) => h.id.includes("Lina") || h.en.includes("Lina")));
  // Timeline: semua clue waktu dalam rentang 20:20-21:00
  check("semua clue waktu dalam rentang timeline",
    CASE.clues.filter((c) => c.minutes !== null).every((c) => c.minutes >= 1220 && c.minutes <= 1260));
  check("parkir sebelum jendela 20:50", CASE.clues.find((c) => c.id === "parkir").minutes < 1250);
  check("akses/patroli/cctv di dalam jendela 20:50-21:00",
    ["akses", "patroli", "cctv-bima"].every((id) => { const c = CASE.clues.find((x) => x.id === id); return c.minutes >= 1250 && c.minutes <= 1260; }));
  // Logika tuduh: simulasi murni (bukan DOM)
  function accuse(suspect, clueId) {
    if (suspect === CASE.culprit && clueId === CASE.breakingClue) return "solved";
    const clue = CASE.clues.find((c) => c.id === clueId);
    if (suspect === CASE.culprit && clue && clue.supporting) return "right-suspect-wrong-clue";
    return "wrong-suspect";
  }
  check("tuduh Lina + akses = solved", accuse("Lina", "akses") === "solved");
  check("tuduh Lina + sidik = tersangka benar, clue salah", accuse("Lina", "sidik") === "right-suspect-wrong-clue");
  check("tuduh Bima + akses = tersangka salah", accuse("Bima", "akses") === "wrong-suspect");
  check("tuduh Rani + parkir = tersangka salah", accuse("Rani", "parkir") === "wrong-suspect");
  check("tuduh Hadi + patroli = tersangka salah", accuse("Hadi", "patroli") === "wrong-suspect");
}

// 3. Struktur halaman + save key + tanpa aset eksternal
check("ada tombol tuduh (btn-accuse)", html.includes('id="btn-accuse"'));
check("ada tombol hint (btn-hint)", html.includes('id="btn-hint"'));
check("ada grid clue + tersangka", html.includes('id="clue-grid"') && html.includes('id="suspect-grid"'));
check("ada layar hasil (screen-result)", html.includes('id="screen-result"'));
check("save key ab_save_v1 dipakai", html.includes("ab_save_v1"));
check("tidak ada <script src=http (tanpa dependensi eksternal)", !html.includes("<script src=http"));
check("bilingual ID/EN tersedia", html.includes('id="btn-id"') && html.includes('id="btn-en"'));

console.log("\n" + pass + " checks passed (exit " + (process.exitCode || 0) + ")");
