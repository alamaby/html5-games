// Test generator acak Level 1 — hanya fungsi murni di GENERATOR-START..END.
// Tidak menguji DOM, browser, atau feel HP.
// Jalankan: node tests/test_generator.mjs  (dari folder alibi-breaker)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(dir, "..", "index.html"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (!cond) { fail++; console.error("FAIL: " + name + " " + extra); }
  else { pass++; console.log("PASS: " + name); }
}

const start = html.indexOf("function mulberry32");
const end = html.indexOf("/* GENERATOR-END */");
check("marker GENERATOR-START/END ada", html.includes("GENERATOR-START") && html.includes("GENERATOR-END") && start >= 0 && end > start);
const section = html.slice(start, end);
// CASE asli dibutuhkan oleh originalCaseCopy(); sediakan dari index.html.
const caseMatch = html.match(/const CASE = (\{[\s\S]*?\n\});/);
check("CASE asli ditemukan untuk test", !!caseMatch);
const loader = "const CASE = " + (caseMatch ? caseMatch[1] : "{}") + ";\n" + section +
  "\nglobalThis.__gen = { mulberry32, pick, shuffleArr, SKINS, NAME_POOL, generateCase, validateCase, buildCase, dailySeedWIB, seedCode };";
new Function(loader)();
const G = globalThis.__gen;

// 1. Seed 0 = kasus asli persis
const orig = G.buildCase(0);
check("seed 0 pelaku = Lina", orig.culprit === "Lina");
check("seed 0 pematah = akses", orig.breakingClue === "akses");
check("seed 0 jam pematah = 20:52 (1252)", orig.clues.find((c) => c.id === "akses").minutes === 1252);
check("seed 0 CCTV = 20:57 (1257)", orig.clues.find((c) => c.clears === "Bima").minutes === 1257);
check("seed 0 parkir = 20:22 (1222)", orig.clues.find((c) => c.id === "parkir").minutes === 1222);
check("seed 0 tidak fallback", orig.fallback === false);

// 2. Determinisme
const a = G.generateCase(12345), b = G.generateCase(12345);
check("seed sama -> JSON identik", JSON.stringify(a) === JSON.stringify(b));
check("seed beda biasanya beda kasus", JSON.stringify(G.generateCase(12345)) !== JSON.stringify(G.generateCase(54321)));

// 3. 100 seed lolos validator (generate langsung, bukan via fallback buildCase)
let validated = 0, genFailures = [];
for (let s = 1; s <= 100; s++) {
  const c = G.generateCase(s);
  const v = G.validateCase(c);
  if (v.ok) validated++;
  else genFailures.push(s + ":" + v.errors.join(";"));
}
check("100 seed generate langsung lolos validator", validated === 100, genFailures.slice(0, 3).join(" | "));
let buildValidated = 0;
for (let s = 1; s <= 100; s++) {
  const c = G.buildCase(s);
  if (G.validateCase(c).ok || c.fallback) buildValidated++;
}
check("100 seed via buildCase selalu valid atau fallback", buildValidated === 100);

// 4. Distribusi kasar: semua skin dan peran pelaku muncul
const skins = new Set(), culpritRoles = new Set(), orders = new Set();
for (let s = 1; s <= 100; s++) {
  const c = G.generateCase(s);
  skins.add(c.skinId);
  const cul = c.suspects.find((x) => x.id === c.culprit);
  culpritRoles.add(cul.role_id);
  orders.add(c.suspects.map((x) => x.id).join(","));
}
check("semua 4 skin muncul dalam 100 seed", skins.size === 4, [...skins].join(","));
check("lebih dari 1 peran pelaku muncul", culpritRoles.size > 1, [...culpritRoles].join(","));
check("urutan tersangka bervariasi (shuffle bekerja)", orders.size > 1);

// 5. Placeholder bocor + bilingual + hint bersih + constraint waktu
function allStrings(obj, out = []) {
  if (typeof obj === "string") out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((x) => allStrings(x, out));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((x) => allStrings(x, out));
  return out;
}
let leak = 0, bilingualFail = 0, hintFail = 0, timeFail = 0;
for (let s = 1; s <= 100; s++) {
  const c = G.generateCase(s);
  if (allStrings(c).some((t) => t.includes("{") || t.includes("}"))) leak++;
  if (c.suspects.some((x) => !x.role_id || !x.role_en || !x.alibi_id || !x.alibi_en || !x.defense_id || !x.defense_en)) bilingualFail++;
  if (c.clues.some((x) => !x.label_id || !x.label_en || !x.detail_id || !x.detail_en)) bilingualFail++;
  if (c.hints.some((h) => h.id.includes(c.culprit) || h.en.includes(c.culprit))) hintFail++;
  const ws = c.windowStartMinutes, we = c.windowEndMinutes;
  const byId = (id) => c.clues.find((x) => x.id === id);
  if (!(byId("akses").minutes >= ws && byId("akses").minutes <= we)) timeFail++;
  if (byId("patroli").minutes !== byId("akses").minutes) timeFail++;
  if (!(byId("cctv").minutes >= ws && byId("cctv").minutes <= we)) timeFail++;
  if (!(byId("parkir").minutes < ws)) timeFail++;
  if (we - ws !== 10) timeFail++;
}
check("tidak ada placeholder bocor (100 seed)", leak === 0);
check("bilingual lengkap (100 seed)", bilingualFail === 0);
check("hint tidak menyebut pelaku (100 seed)", hintFail === 0);
check("constraint waktu terpenuhi (100 seed)", timeFail === 0);

// 6. Shuffle tidak mengubah solusi
let shuffleOk = true;
for (let s = 1; s <= 20; s++) {
  const c1 = G.generateCase(s), c2 = G.generateCase(s);
  if (c1.culprit !== c2.culprit || c1.breakingClue !== c2.breakingClue) shuffleOk = false;
}
check("shuffle/determinisme tidak mengubah solusi", shuffleOk);

// 7. Fallback: validator yang selalu gagal -> kembali ke kasus asli
const fb = G.buildCase(999, () => ({ ok: false, errors: ["forced"] }));
check("fallback kembali ke Lina + akses", fb.culprit === "Lina" && fb.breakingClue === "akses" && fb.fallback === true);

// 8. Seed harian WIB: 8 digit, masuk akal
const daily = G.dailySeedWIB();
check("dailySeedWIB 8 digit", String(daily).length === 8 && daily >= 20260101 && daily <= 20991231, String(daily));
check("seedCode(0)=Asli, seedCode(482913)=AB-482913", G.seedCode(0) === "Asli" && G.seedCode(482913) === "AB-482913");

// 9. Struktur output sama dengan CASE asli (field kunci ada)
const sample = G.generateCase(7);
check("output punya field CASE kunci", ["culprit", "breakingClue", "suspects", "clues", "hints", "logic_id", "logic_en"].every((k) => k in sample));
check("output 4 tersangka + 5 clue", sample.suspects.length === 4 && sample.clues.length === 5);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
