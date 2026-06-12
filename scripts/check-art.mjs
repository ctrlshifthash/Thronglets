// Validates the pixel-art patterns in src/lib/tiles.ts.
// Node >= 23 strips TypeScript types natively, so we can import the .ts file.
const { validateTileArt, validateCharArt } = await import('../src/lib/tiles.ts');

try {
  validateTileArt();
  validateCharArt();
  console.log('All tile + character art patterns are valid.');
} catch (err) {
  console.error(String(err?.message ?? err));
  process.exit(1);
}
