// Example script: Clear browser cache and storage
// Use when testing fresh user experience

console.log('Clearing browser cache and storage...');

// Clear cookies
const context = await page.context();
await context.clearCookies();
console.log('  ✓ Cookies cleared');

// Clear localStorage
await page.evaluate(() => {
  localStorage.clear();
});
console.log('  ✓ localStorage cleared');

// Clear sessionStorage
await page.evaluate(() => {
  sessionStorage.clear();
});
console.log('  ✓ sessionStorage cleared');

// Clear IndexedDB
await page.evaluate(async () => {
  const databases = await indexedDB.databases();
  databases.forEach(db => {
    if (db.name) {
      indexedDB.deleteDatabase(db.name);
    }
  });
});
console.log('  ✓ IndexedDB cleared');

// Reload to apply changes
await page.reload({ waitUntil: 'networkidle' });
console.log('  ✓ Page reloaded');

console.log('✓ Browser cache and storage cleared successfully');
console.log('  Browser is now in fresh state');

// Clear sharedState as well (optional)
if (sharedState.clearSharedState) {
  const keys = Object.keys(sharedState);
  keys.forEach(key => {
    if (key !== 'clearSharedState') {
      delete sharedState[key];
    }
  });
  console.log('  ✓ sharedState cleared');
}
