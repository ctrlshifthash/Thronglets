// Verify the Privy app ID actually got baked into the deployed client bundle.
const base = 'https://playthronglets.app';
const APP_ID = 'cmqcb73cs00h20bl5qo8j2ug6';

const html = await (await fetch(base + '/dashboard')).text();
const chunks = [...new Set([...html.matchAll(/\/_next\/static\/[^"']+?\.js/g)].map((m) => m[0]))];
console.log('chunks found:', chunks.length);

let found = false;
let scanned = 0;
for (const c of chunks) {
  try {
    const j = await (await fetch(base + c)).text();
    scanned++;
    if (j.includes(APP_ID)) {
      console.log('PRIVY APP ID baked in chunk:', c);
      found = true;
      break;
    }
  } catch {
    /* ignore */
  }
}
console.log('scanned', scanned, 'chunks; privy id present:', found);
