// Example script: Capture screenshots of a user flow
// Customize the flow for your application

const flowName = sharedState.flowName || 'default-flow';
const screenshotDir = `/tmp/flows/${flowName}`;

console.log(`Capturing flow: ${flowName}`);
console.log(`Screenshots will be saved to: ${screenshotDir}`);

// Step 1: Home page
await page.goto('http://localhost:3000');
await page.screenshot({
  path: `${screenshotDir}/01-home.png`,
  fullPage: true
});
console.log('  ✓ Step 1: Home page');

// Step 2: Product listing
await page.click('a[href="/products"]');
await page.waitForSelector('.product-grid');
await page.screenshot({
  path: `${screenshotDir}/02-products.png`,
  fullPage: true
});
console.log('  ✓ Step 2: Product listing');

// Step 3: Product detail
await page.click('.product-card:first-child');
await page.waitForSelector('.product-detail');
await page.screenshot({
  path: `${screenshotDir}/03-product-detail.png`,
  fullPage: true
});
console.log('  ✓ Step 3: Product detail');

// Step 4: Add to cart
await page.click('button:has-text("Add to Cart")');
await page.waitForSelector('.cart-badge');
await page.screenshot({
  path: `${screenshotDir}/04-added-to-cart.png`,
  fullPage: true
});
console.log('  ✓ Step 4: Added to cart');

// Step 5: Cart view
await page.click('.cart-icon');
await page.waitForSelector('.cart-items');
await page.screenshot({
  path: `${screenshotDir}/05-cart.png`,
  fullPage: true
});
console.log('  ✓ Step 5: Cart view');

// Step 6: Checkout
await page.click('button:has-text("Checkout")');
await page.waitForSelector('.checkout-form');
await page.screenshot({
  path: `${screenshotDir}/06-checkout.png`,
  fullPage: true
});
console.log('  ✓ Step 6: Checkout');

console.log(`✓ Flow captured: ${flowName}`);
console.log(`  Total screenshots: 6`);
console.log(`  Location: ${screenshotDir}/`);

// Save metadata
sharedState.lastFlowCapture = {
  name: flowName,
  timestamp: Date.now(),
  screenshotCount: 6,
  directory: screenshotDir
};
