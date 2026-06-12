// Repairs cp1252-mojibake'd UTF-8 (PowerShell Get-Content/Set-Content damage):
// every original multibyte char became 2-3 cp1252 glyphs; reverse-map those
// glyphs to their byte values and re-decode the byte stream as UTF-8.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('usage: node fix-encoding.mjs <file>');

const CP1252_REVERSE = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85,
  '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
  '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92,
  '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c,
  'ž': 0x9e, 'Ÿ': 0x9f,
};

let s = readFileSync(file, 'utf8');
if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // strip PS-added BOM

const bytes = [];
let unknown = 0;
for (const ch of s) {
  const c = ch.codePointAt(0);
  if (c < 0x100) bytes.push(c);
  else if (CP1252_REVERSE[ch] !== undefined) bytes.push(CP1252_REVERSE[ch]);
  else {
    unknown++;
    bytes.push(0x3f);
  }
}
const fixed = Buffer.from(bytes).toString('utf8');
if (fixed.includes('�')) {
  console.error('ABORT: repair would produce replacement characters — not writing.');
  process.exit(1);
}
writeFileSync(file, fixed);
console.log(`repaired ${file} (${unknown} unmappable chars)`);
