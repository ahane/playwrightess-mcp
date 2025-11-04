// Example session: Login to a demo application
// This is a template - customize for your project

await page.goto('http://localhost:3000/login');
await page.fill('#email', 'demo@example.com');
await page.fill('#password', 'demopass123');
await page.click('button[type=submit]');

// Wait for redirect to dashboard
await page.waitForURL('**/dashboard', { timeout: 8000 });

// Verify we're logged in
const username = await page.textContent('.user-menu .username');
console.log('✓ Logged in as:', username);

// Save user info to shared state
sharedState.currentUser = {
  email: 'demo@example.com',
  username: username
};
