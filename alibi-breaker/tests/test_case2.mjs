// Test Kasus 2 Alibi Breaker — validasi data + logika tuduh 2 bukti.
// Bukan test browser: tidak membaca console browser, tidak menguji feel HP.
// Jalankan: node tests/test_case2.mjs  (dari folder alibi-breaker)
import { readFileSync } from "node:fs";
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

function extractConst(name) {
  const start = html.indexOf("const " + name + " = {");
  check(name + " ditemukan di index.html", start >= 0);
  if (start < 0) return null;
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
  check(name + " tertutup dengan benar", end > objStart);
  return end > objStart ? new Function("return (" + html.slice(objStart, end + 1) + ")")() : null;
}

const C = extractConst("CASE2");
if (C) {
  check("pelaku = Maya (sesuai DESIGN §5.2)", C.culprit === "Maya");
  check("breakingClues = cctv-kosong + sepatu-kunci",
    JSON.stringify(C.breakingClues) === JSON.stringify(["cctv-kosong", "sepatu-kunci"]));
  check("jumlah tersangka = 4", C.suspects.length === 4);
  check("jumlah clue = 6", C.clues.length === 6);
  check("id tersangka unik", new Set(C.suspects.map((s) => s.id)).size === 4);
  check("id clue unik", new Set(C.clues.map((c) => c.id)).size === 6);
  check("tersangka = Sinta, Joko, Maya, Tono",
    JSON.stringify(C.suspects.map((s) => s.id)) === JSON.stringify(["Sinta", "Joko", "Maya", "Tono"]));
  for (const s of C.suspects) {
    if (s.id === C.culprit) continue;
    const def = C.clues.find((c) => c.clears === s.id);
    check("non-pelaku " + s.id + " punya clue pembela", !!def);
    check("tersangka " + s.id + " punya teks defense ID+EN", !!(s.defense_id && s.defense_en));
  }
  const both = C.breakingClues.map((id) => C.clues.find((c) => c.id === id));
  check("kedua pematah ada dan mematahkan Maya", both.every((c) => c && c.breaks === "Maya"));
  check("kedua pematah bertanda breakerPart", both.every((c) => c.breakerPart === true));
  const herring = C.clues.find((c) => c.id === "sidik-sinta");
  check("red herring sidik-sinta ada dan dijelaskan log stok 18.30",
    !!herring && herring.redHerring === true && herring.detail_id.includes("18.30"));
  check("cctv-kosong menit 19:50 di awal celah, di dalam jendela 20.00-20.15? tidak: 19:50 sebelum jendela (celah dimulai sebelum jendela)",
    C.clues.find((c) => c.id === "cctv-kosong").minutes === 1190);
  check("jendela 20.00-20.15 (15 menit)", C.windowStartMinutes === 1200 && C.windowEndMinutes === 1215);
  check("timeline 19.20-20.15", C.timelineStartMinutes === 1160 && C.timelineEndMinutes === 1215);
  check("semua clue waktu dalam rentang timeline",
    C.clues.filter((c) => c.minutes !== null).every((c) => c.minutes >= 1160 && c.minutes <= 1215));
  check("cctv-dapur 20.07 di dalam jendela", C.clues.find((c) => c.id === "cctv-dapur").minutes >= 1200 && C.clues.find((c) => c.id === "cctv-dapur").minutes <= 1215);
  check("jumlah hint = 2", C.hints.length === 2);
  check("hint tidak menyebut Maya", !C.hints.some((h) => h.id.includes("Maya") || h.en.includes("Maya")));
  check("field bilingual lengkap (suspect + clue + logic + result)",
    C.suspects.every((s) => s.role_id && s.role_en && s.alibi_id && s.alibi_en) &&
    C.clues.every((c) => c.label_id && c.label_en && c.detail_id && c.detail_en) &&
    C.logic_id.length >= 4 && C.logic_en.length === C.logic_id.length &&
    C.result_id && C.result_en && C.title_id && C.title_en && C.briefMeta_id && C.briefMeta_en);
  check("rantai logika menyebut gabungan CCTV + sepatu",
    C.logic_id.join(" ").includes("CCTV kasir kosong") && C.logic_id.join(" ").includes("jejak sol sepatu"));
  check("skin = kafe", C.skinId === "kafe");

  // Logika tuduh 2 bukti, simulasi murni (mirror logika di index.html)
  function accuse(suspect, sel) {
    const req = C.breakingClues;
    const same = sel.length === req.length && sel.every((x) => req.includes(x));
    if (suspect === C.culprit && same) return "solved";
    if (suspect === C.culprit && sel.length === 1 && sel[0] === "cctv-kosong") return "weak-only";
    if (suspect === C.culprit && sel.length === 1 && sel[0] === "sepatu-kunci") return "partial-only";
    if (suspect === C.culprit) return "wrong-combo";
    return "wrong-suspect";
  }
  check("tuduh Maya + kedua bukti = solved", accuse("Maya", ["cctv-kosong", "sepatu-kunci"]) === "solved");
  check("tuduh Maya + urutan terbalik = solved", accuse("Maya", ["sepatu-kunci", "cctv-kosong"]) === "solved");
  check("tuduh Maya + hanya cctv-kosong = weak-only", accuse("Maya", ["cctv-kosong"]) === "weak-only");
  check("tuduh Maya + hanya sepatu-kunci = partial-only", accuse("Maya", ["sepatu-kunci"]) === "partial-only");
  check("tuduh Maya + sepatu + sidik-sinta = wrong-combo", accuse("Maya", ["sepatu-kunci", "sidik-sinta"]) === "wrong-combo");
  check("tuduh Sinta + kedua bukti = wrong-suspect", accuse("Sinta", ["cctv-kosong", "sepatu-kunci"]) === "wrong-suspect");
}

// Struktur halaman: pemilih kasus, save Kasus 2, scene kafe, ikon baru
check("ada tombol pilih kasus 1 dan 2", html.includes('id="btn-case-1"') && html.includes('id="btn-case-2"'));
check("save case2 dipakai", html.includes("s.case2"));
check("unlock Kasus 2 memeriksa case1/random/daily", html.includes("isCase2Unlocked"));
check("scene kafe ada", html.includes("kafe:"));
check("ikon cctv-kosong dan sepatu-kunci ada", html.includes('"cctv-kosong"') && html.includes('"sepatu-kunci"'));
check("pesan wrongWeak/wrongPartial/wrongCombo ada", html.includes("wrongWeak") && html.includes("wrongPartial") && html.includes("wrongCombo"));
check("Kasus 1 tetap memakai breakingClue tunggal", html.includes('breakingClue: "akses"'));
check("helper requiredBreakers ada", html.includes("requiredBreakers"));

console.log("\n" + pass + " checks passed (exit " + (process.exitCode || 0) + ")");
