// Example script: Create test data via UI
// Customize for your application's data model

console.log('Creating test data...');

// Initialize storage for created data
if (!sharedState.testData) {
  sharedState.testData = {
    users: [],
    items: []
  };
}

// Example: Create 3 test users
for (let i = 1; i <= 3; i++) {
  await page.goto('http://localhost:3000/admin/users/new');

  await page.fill('#name', `Test User ${i}`);
  await page.fill('#email', `testuser${i}@example.com`);
  await page.selectOption('#role', 'user');

  await page.click('button:has-text("Create User")');

  // Wait for success and capture user ID
  await page.waitForSelector('.success-message');
  const userId = await page.textContent('.user-id');

  sharedState.testData.users.push({
    id: userId,
    name: `Test User ${i}`,
    email: `testuser${i}@example.com`
  });

  console.log(`  ✓ Created user ${i}: ${userId}`);
}

// Example: Create 5 test items
for (let i = 1; i <= 5; i++) {
  await page.goto('http://localhost:3000/admin/items/new');

  await page.fill('#title', `Test Item ${i}`);
  await page.fill('#description', `Description for test item ${i}`);
  await page.fill('#price', (i * 10).toString());

  await page.click('button:has-text("Create Item")');

  await page.waitForSelector('.success-message');
  const itemId = await page.textContent('.item-id');

  sharedState.testData.items.push({
    id: itemId,
    title: `Test Item ${i}`,
    price: i * 10
  });

  console.log(`  ✓ Created item ${i}: ${itemId}`);
}

console.log('✓ Test data created successfully!');
console.log('  Users:', sharedState.testData.users.length);
console.log('  Items:', sharedState.testData.items.length);
