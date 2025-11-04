# Common Development Workflows

This document describes practical workflows where persistent browser state is valuable during development.

## Table of Contents

1. [Debugging Authentication Issues](#debugging-authentication-issues)
2. [Interactive SPA Exploration](#interactive-spa-exploration)
3. [Multi-Step Form Testing](#multi-step-form-testing)
4. [Data Extraction from Protected Pages](#data-extraction-from-protected-pages)
5. [Visual Regression Testing](#visual-regression-testing)
6. [Recording User Flows](#recording-user-flows)
7. [API Response Interception](#api-response-interception)
8. [Building Test Fixtures](#building-test-fixtures)
9. [Production Monitoring](#production-monitoring)
10. [E2E Test Development](#e2e-test-development)

---

## Debugging Authentication Issues

### Problem
Your authentication flow is broken but you're not sure where. Traditional scripts restart the browser each time, losing state.

### Workflow

```bash
# Start session
node dist/cli.js start

# Navigate to login
node dist/cli.js eval "await page.goto('https://myapp.com/login')"

# Take screenshot to see initial state
node dist/cli.js eval "await page.screenshot({path: '/tmp/1-login-page.png'})"

# Check what's on the page
node dist/cli.js eval "console.log(await page.content())"

# Try filling the form
node dist/cli.js eval "await page.fill('#email', 'test@example.com')"

# Hmm, did that work? Check the value
node dist/cli.js eval "console.log('Email value:', await page.inputValue('#email'))"

# Try password
node dist/cli.js eval "await page.fill('#password', 'password123')"

# Screenshot before submit
node dist/cli.js eval "await page.screenshot({path: '/tmp/2-before-submit.png'})"

# Submit
node dist/cli.js eval "await page.click('button[type=submit]')"

# Wait a bit
node dist/cli.js eval "await page.waitForTimeout(2000)"

# Check where we ended up
node dist/cli.js eval "console.log('Current URL:', page.url())"

# Screenshot after submit
node dist/cli.js eval "await page.screenshot({path: '/tmp/3-after-submit.png'})"

# Check for error messages
node dist/cli.js eval "const error = await page.$('.error-message'); console.log('Has error:', !!error)"

# If there's an error, read it
node dist/cli.js eval "const error = await page.textContent('.error-message'); console.log('Error:', error)"

# Check cookies to see if we got a session
node dist/cli.js eval "const cookies = await page.context().cookies(); console.log('Cookies:', cookies.map(c => c.name))"

# Done - stop when finished
node dist/cli.js stop
```

### Why Stateful?
- Can inspect at each step without restarting
- Browser stays open to visually debug
- Can try different approaches without losing progress
- Screenshots capture the exact state at each step

---

## Interactive SPA Exploration

### Problem
You're working with a complex React/Vue/Angular app and need to understand how state changes as you interact with it.

### Workflow

```bash
# Start and navigate
node dist/cli.js start
node dist/cli.js eval "await page.goto('https://app.example.com')"

# Log in (if needed)
node dist/cli.js eval "await page.fill('#email', 'dev@example.com')"
node dist/cli.js eval "await page.fill('#password', 'devpass')"
node dist/cli.js eval "await page.click('button[type=submit]')"

# Now explore the app interactively
# Click on different sections and inspect state

# Open settings panel
node dist/cli.js eval "await page.click('[data-testid=settings-button]')"

# Check what appears
node dist/cli.js eval "const visible = await page.isVisible('.settings-panel'); console.log('Panel visible:', visible)"

# Inspect React component state (if React DevTools available)
node dist/cli.js eval "
  const state = await page.evaluate(() => {
    // Access React internals (if available)
    const root = document.querySelector('#root');
    return root?._reactRootContainer?._internalRoot?.current?.memoizedState;
  });
  console.log('React state:', state);
"

# Change a setting
node dist/cli.js eval "await page.click('[data-testid=dark-mode-toggle]')"

# Check if it persisted
node dist/cli.js eval "
  const isDark = await page.evaluate(() =>
    document.body.classList.contains('dark-mode')
  );
  console.log('Dark mode:', isDark);
"

# Navigate to another section (state maintained!)
node dist/cli.js eval "await page.click('a[href=/dashboard]')"

# Check localStorage for state persistence
node dist/cli.js eval "
  const storage = await page.evaluate(() =>
    JSON.stringify(localStorage, null, 2)
  );
  console.log('LocalStorage:', storage);
"

# Done
node dist/cli.js stop
```

### Why Stateful?
- Can explore the app naturally without scripts
- State changes accumulate (like real usage)
- Can inspect at any point without losing context
- Perfect for understanding complex state management

---

## Multi-Step Form Testing

### Problem
You have a multi-step checkout flow and need to test various paths through it.

### Workflow

```bash
node dist/cli.js start

# Step 1: Add items to cart
node dist/cli.js eval "await page.goto('https://shop.example.com')"
node dist/cli.js eval "await page.click('[data-product-id=123] .add-to-cart')"
node dist/cli.js eval "await page.click('[data-product-id=456] .add-to-cart')"

# Save cart state
node dist/cli.js eval "
  const cartCount = await page.textContent('.cart-count');
  sharedState.cartCount = cartCount;
  console.log('Cart items:', cartCount);
"

# Step 2: Go to checkout
node dist/cli.js eval "await page.click('.cart-icon')"
node dist/cli.js eval "await page.click('button:has-text(\"Checkout\")')"

# Step 3: Fill shipping info
node dist/cli.js eval "await page.fill('#shipping-name', 'Test User')"
node dist/cli.js eval "await page.fill('#shipping-address', '123 Main St')"
node dist/cli.js eval "await page.fill('#shipping-city', 'San Francisco')"
node dist/cli.js eval "await page.fill('#shipping-zip', '94102')"
node dist/cli.js eval "await page.click('button:has-text(\"Continue\")')"

# Screenshot for verification
node dist/cli.js eval "await page.screenshot({path: '/tmp/checkout-step-2.png', fullPage: true})"

# Step 4: Payment info
node dist/cli.js eval "await page.fill('#card-number', '4242424242424242')"
node dist/cli.js eval "await page.fill('#card-exp', '12/25')"
node dist/cli.js eval "await page.fill('#card-cvc', '123')"

# Before submitting, save the form state
node dist/cli.js eval "
  const formData = await page.evaluate(() => ({
    name: document.querySelector('#shipping-name')?.value,
    address: document.querySelector('#shipping-address')?.value,
    cardLast4: document.querySelector('#card-number')?.value.slice(-4)
  }));
  sharedState.formData = formData;
  console.log('Form data:', formData);
"

# Step 5: Review and submit
node dist/cli.js eval "await page.click('button:has-text(\"Place Order\")')"

# Wait for confirmation
node dist/cli.js eval "await page.waitForSelector('.order-confirmation', {timeout: 10000})"

# Extract order number
node dist/cli.js eval "
  const orderNum = await page.textContent('.order-number');
  sharedState.orderNumber = orderNum;
  console.log('Order number:', orderNum);
"

# Screenshot confirmation
node dist/cli.js eval "await page.screenshot({path: '/tmp/order-confirmation.png'})"

node dist/cli.js stop
```

### Why Stateful?
- Can test the entire flow without restarting
- Can pause at any step to inspect
- Can modify data and continue
- State naturally flows through steps like real usage

---

## Data Extraction from Protected Pages

### Problem
You need to scrape data from multiple pages that require authentication.

### Workflow

```bash
node dist/cli.js start

# Login once
node dist/cli.js eval "await page.goto('https://dashboard.example.com/login')"
node dist/cli.js eval "await page.fill('#email', 'scraper@example.com')"
node dist/cli.js eval "await page.fill('#password', 'scraperpass')"
node dist/cli.js eval "await page.click('button[type=submit]')"

# Initialize data collection
node dist/cli.js eval "sharedState.allData = []"

# Scrape page 1
node dist/cli.js eval "await page.goto('https://dashboard.example.com/reports/page/1')"
node dist/cli.js eval "
  const pageData = await page.$$eval('.data-row', rows =>
    rows.map(row => ({
      name: row.querySelector('.name')?.textContent,
      value: row.querySelector('.value')?.textContent
    }))
  );
  sharedState.allData.push(...pageData);
  console.log('Page 1 - Collected:', pageData.length, 'items');
"

# Scrape page 2 (still logged in!)
node dist/cli.js eval "await page.goto('https://dashboard.example.com/reports/page/2')"
node dist/cli.js eval "
  const pageData = await page.$$eval('.data-row', rows =>
    rows.map(row => ({
      name: row.querySelector('.name')?.textContent,
      value: row.querySelector('.value')?.textContent
    }))
  );
  sharedState.allData.push(...pageData);
  console.log('Page 2 - Collected:', pageData.length, 'items');
"

# Continue for more pages...
node dist/cli.js eval "await page.goto('https://dashboard.example.com/reports/page/3')"
node dist/cli.js eval "
  const pageData = await page.$$eval('.data-row', rows =>
    rows.map(row => ({
      name: row.querySelector('.name')?.textContent,
      value: row.querySelector('.value')?.textContent
    }))
  );
  sharedState.allData.push(...pageData);
  console.log('Page 3 - Collected:', pageData.length, 'items');
"

# Show total collected
node dist/cli.js eval "console.log('Total items collected:', sharedState.allData.length)"

# Export to JSON (save via file write from the collected data)
node dist/cli.js eval "console.log(JSON.stringify(sharedState.allData, null, 2))"

node dist/cli.js stop
```

### Why Stateful?
- Login session persists across all page visits
- Can accumulate data incrementally
- Don't need to re-authenticate for each page
- Can pause, inspect, and continue scraping

---

## Visual Regression Testing

### Problem
You're making CSS changes and want to capture screenshots before/after across multiple pages.

### Workflow

```bash
node dist/cli.js start

# Login and navigate to app
node dist/cli.js eval "await page.goto('https://staging.example.com/login')"
node dist/cli.js eval "await page.fill('#email', 'tester@example.com')"
node dist/cli.js eval "await page.fill('#password', 'testpass')"
node dist/cli.js eval "await page.click('button[type=submit]')"

# Capture baseline screenshots across the flow
node dist/cli.js eval "await page.goto('https://staging.example.com/home')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/baseline/home.png', fullPage: true})"

node dist/cli.js eval "await page.goto('https://staging.example.com/products')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/baseline/products.png', fullPage: true})"

node dist/cli.js eval "await page.goto('https://staging.example.com/cart')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/baseline/cart.png', fullPage: true})"

node dist/cli.js eval "await page.goto('https://staging.example.com/checkout')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/baseline/checkout.png', fullPage: true})"

# Test different viewport sizes (still logged in!)
node dist/cli.js eval "await page.setViewportSize({width: 375, height: 812})"  # iPhone
node dist/cli.js eval "await page.goto('https://staging.example.com/home')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/baseline/home-mobile.png', fullPage: true})"

node dist/cli.js eval "await page.setViewportSize({width: 768, height: 1024})"  # iPad
node dist/cli.js eval "await page.goto('https://staging.example.com/home')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/baseline/home-tablet.png', fullPage: true})"

# Test dark mode
node dist/cli.js eval "await page.emulateMedia({colorScheme: 'dark'})"
node dist/cli.js eval "await page.goto('https://staging.example.com/home')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/baseline/home-dark.png', fullPage: true})"

node dist/cli.js stop
```

### Why Stateful?
- Login once, test everywhere
- Can change viewport/theme without losing session
- Natural flow through the app
- Fast iteration on visual testing

---

## Recording User Flows

### Problem
You need to document a user flow for onboarding docs or bug reports.

### Workflow

```bash
node dist/cli.js start

# Initialize recording
node dist/cli.js eval "sharedState.steps = []"

# Step 1
node dist/cli.js eval "await page.goto('https://app.example.com')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/flow/01-landing.png'})"
node dist/cli.js eval "sharedState.steps.push({step: 1, desc: 'Landing page', img: '01-landing.png'})"

# Step 2
node dist/cli.js eval "await page.click('button:has-text(\"Get Started\")')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/flow/02-signup.png'})"
node dist/cli.js eval "sharedState.steps.push({step: 2, desc: 'Sign up form', img: '02-signup.png'})"

# Step 3
node dist/cli.js eval "await page.fill('#name', 'New User')"
node dist/cli.js eval "await page.fill('#email', 'new@example.com')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/flow/03-filled-form.png'})"
node dist/cli.js eval "sharedState.steps.push({step: 3, desc: 'Filled form', img: '03-filled-form.png'})"

# Step 4
node dist/cli.js eval "await page.click('button:has-text(\"Create Account\")')"
node dist/cli.js eval "await page.waitForSelector('.welcome-message')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/flow/04-welcome.png'})"
node dist/cli.js eval "sharedState.steps.push({step: 4, desc: 'Welcome screen', img: '04-welcome.png'})"

# Generate markdown doc
node dist/cli.js eval "
  const markdown = sharedState.steps.map(s =>
    \`## Step \${s.step}: \${s.desc}\n\n![\${s.desc}](./\${s.img})\n\`
  ).join('\n');
  console.log(markdown);
"

node dist/cli.js stop
```

### Why Stateful?
- Natural progression through the flow
- Can annotate as you go
- Screenshots capture actual usage
- Easy to regenerate if flow changes

---

## API Response Interception

### Problem
You want to test how your UI handles different API responses.

### Workflow

```bash
node dist/cli.js start

# Setup route interception
node dist/cli.js eval "
  await page.route('**/api/users', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: [
          {id: 1, name: 'Test User 1'},
          {id: 2, name: 'Test User 2'}
        ]
      })
    });
  });
"

# Navigate and see mocked data
node dist/cli.js eval "await page.goto('https://app.example.com/users')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/api/success.png'})"

# Now test error handling - change the intercept
node dist/cli.js eval "
  await page.unroute('**/api/users');
  await page.route('**/api/users', route => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({error: 'Internal Server Error'})
    });
  });
"

# Reload to see error state
node dist/cli.js eval "await page.reload()"
node dist/cli.js eval "await page.screenshot({path: '/tmp/api/error.png'})"

# Test empty state
node dist/cli.js eval "
  await page.unroute('**/api/users');
  await page.route('**/api/users', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({users: []})
    });
  });
"

node dist/cli.js eval "await page.reload()"
node dist/cli.js eval "await page.screenshot({path: '/tmp/api/empty.png'})"

node dist/cli.js stop
```

### Why Stateful?
- Can modify intercepts without restarting
- Test multiple scenarios in same session
- Quickly iterate on edge cases
- Page state maintained between tests

---

## Building Test Fixtures

### Problem
You need to set up complex test data by clicking through the UI.

### Workflow

```bash
node dist/cli.js start

# Login as admin
node dist/cli.js eval "await page.goto('https://app.example.com/admin/login')"
node dist/cli.js eval "await page.fill('#email', 'admin@example.com')"
node dist/cli.js eval "await page.fill('#password', 'adminpass')"
node dist/cli.js eval "await page.click('button[type=submit]')"

# Create fixture 1: User
node dist/cli.js eval "await page.goto('https://app.example.com/admin/users/new')"
node dist/cli.js eval "await page.fill('#name', 'Fixture User 1')"
node dist/cli.js eval "await page.fill('#email', 'fixture1@example.com')"
node dist/cli.js eval "await page.click('button:has-text(\"Create User\")')"

# Capture user ID for later use
node dist/cli.js eval "
  const userId = await page.textContent('.user-id');
  sharedState.fixtureUserId = userId;
  console.log('Created user:', userId);
"

# Create fixture 2: Project for that user
node dist/cli.js eval "await page.goto('https://app.example.com/admin/projects/new')"
node dist/cli.js eval "await page.fill('#title', 'Test Project')"
node dist/cli.js eval "await page.selectOption('#owner-id', sharedState.fixtureUserId)"
node dist/cli.js eval "await page.click('button:has-text(\"Create Project\")')"

# Capture project ID
node dist/cli.js eval "
  const projectId = await page.textContent('.project-id');
  sharedState.fixtureProjectId = projectId;
  console.log('Created project:', projectId);
"

# Create fixture 3: Tasks for that project
node dist/cli.js eval "await page.goto(\`https://app.example.com/admin/tasks/new?project=\${sharedState.fixtureProjectId}\`)"
node dist/cli.js eval "await page.fill('#title', 'Task 1')"
node dist/cli.js eval "await page.click('button:has-text(\"Create Task\")')"

# Export fixture IDs for use in tests
node dist/cli.js eval "
  const fixtures = {
    userId: sharedState.fixtureUserId,
    projectId: sharedState.fixtureProjectId
  };
  console.log('Fixtures created:', JSON.stringify(fixtures, null, 2));
"

node dist/cli.js stop
```

### Why Stateful?
- Build complex related data step-by-step
- IDs from previous steps available
- Natural admin UI workflow
- Can verify at each step

---

## Production Monitoring

### Problem
You want to verify your production site is working by simulating real user behavior.

### Workflow

```bash
node dist/cli.js start

# Initialize monitoring state
node dist/cli.js eval "sharedState.checks = {passed: 0, failed: 0, errors: []}"

# Check 1: Homepage loads
node dist/cli.js eval "
  try {
    await page.goto('https://production.example.com', {waitUntil: 'networkidle', timeout: 8000});
    sharedState.checks.passed++;
    console.log('✓ Homepage loaded');
  } catch (e) {
    sharedState.checks.failed++;
    sharedState.checks.errors.push('Homepage failed: ' + e.message);
    console.log('✗ Homepage failed');
  }
"

# Check 2: Can login
node dist/cli.js eval "
  try {
    await page.fill('#email', 'monitor@example.com');
    await page.fill('#password', 'monitorpass');
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', {timeout: 8000});
    sharedState.checks.passed++;
    console.log('✓ Login successful');
  } catch (e) {
    sharedState.checks.failed++;
    sharedState.checks.errors.push('Login failed: ' + e.message);
    console.log('✗ Login failed');
  }
"

# Check 3: Dashboard shows data
node dist/cli.js eval "
  try {
    const hasData = await page.locator('.dashboard-stats').count() > 0;
    if (hasData) {
      sharedState.checks.passed++;
      console.log('✓ Dashboard shows data');
    } else {
      throw new Error('No dashboard data found');
    }
  } catch (e) {
    sharedState.checks.failed++;
    sharedState.checks.errors.push('Dashboard check failed: ' + e.message);
    console.log('✗ Dashboard check failed');
  }
"

# Check 4: Can access protected page
node dist/cli.js eval "
  try {
    await page.goto('https://production.example.com/reports');
    const title = await page.title();
    if (title.includes('Reports')) {
      sharedState.checks.passed++;
      console.log('✓ Reports page accessible');
    } else {
      throw new Error('Reports page title wrong');
    }
  } catch (e) {
    sharedState.checks.failed++;
    sharedState.checks.errors.push('Reports check failed: ' + e.message);
    console.log('✗ Reports check failed');
  }
"

# Report results
node dist/cli.js eval "
  console.log('\n=== Monitoring Results ===');
  console.log('Passed:', sharedState.checks.passed);
  console.log('Failed:', sharedState.checks.failed);
  if (sharedState.checks.errors.length > 0) {
    console.log('\nErrors:');
    sharedState.checks.errors.forEach(e => console.log('  -', e));
  }
"

node dist/cli.js stop
```

### Why Stateful?
- Multiple checks in one authenticated session
- Can accumulate results
- Realistic user flow simulation
- Fast execution without repeated auth

---

## E2E Test Development

### Problem
You're writing an E2E test and need to figure out the right selectors and timing.

### Workflow

```bash
node dist/cli.js start

# Start at the page you're testing
node dist/cli.js eval "await page.goto('http://localhost:3000/signup')"

# Try different selectors until you find the right one
node dist/cli.js eval "const btn = await page.$('button'); console.log('Found button:', !!btn)"
node dist/cli.js eval "const btn = await page.$('.submit-button'); console.log('Found .submit-button:', !!btn)"
node dist/cli.js eval "const btn = await page.$('[data-testid=signup-submit]'); console.log('Found data-testid:', !!btn)"

# Found it! Test the interaction
node dist/cli.js eval "await page.fill('[data-testid=name-input]', 'Test User')"

# Verify it worked
node dist/cli.js eval "console.log('Name value:', await page.inputValue('[data-testid=name-input]'))"

# Continue building the test
node dist/cli.js eval "await page.fill('[data-testid=email-input]', 'test@example.com')"
node dist/cli.js eval "await page.click('[data-testid=signup-submit]')"

# Figure out what to wait for
node dist/cli.js eval "await page.waitForTimeout(1000)"
node dist/cli.js eval "console.log('URL is now:', page.url())"

# Check if success message appears
node dist/cli.js eval "const success = await page.$('.success-message'); console.log('Has success message:', !!success)"

# Found it - now build final test from the working commands
# Copy successful commands into your test file

node dist/cli.js stop
```

### Why Stateful?
- Iteratively discover the right selectors
- Don't restart browser after each attempt
- Can experiment with timing/waits
- Build confidence before writing test code

---

## Best Practices for Workflows

### 1. Always Initialize State Objects

```bash
node dist/cli.js eval "sharedState.myData = []"
node dist/cli.js eval "sharedState.config = {}"
```

### 2. Save Screenshots at Key Points

```bash
node dist/cli.js eval "await page.screenshot({path: '/tmp/step-\${Date.now()}.png'})"
```

### 3. Use Console Logs Liberally

```bash
node dist/cli.js eval "console.log('Current state:', sharedState)"
```

### 4. Handle Errors Gracefully

```bash
node dist/cli.js eval "
  try {
    await page.click('.might-not-exist');
  } catch (e) {
    console.log('Element not found, continuing...');
  }
"
```

### 5. Clean Up When Done

```bash
node dist/cli.js stop  # Always stop to save state and close browser
```

---

## Tips for Claude Code Integration

When using this skill with Claude Code, you can:

1. **Ask Claude to execute workflows:**
   - "Use playwright-stateful to debug the login flow on localhost:3000"
   - "Scrape the product data from staging.myapp.com"

2. **Ask Claude to build incrementally:**
   - "Start a session and navigate to the checkout page"
   - "Now fill in the shipping form"
   - "Take a screenshot and continue to payment"

3. **Ask Claude to explore:**
   - "Start a session and explore the admin panel, capturing screenshots of each section"

4. **Ask Claude to extract data:**
   - "Login to the dashboard and extract all user data from the table"

Claude will use the skill automatically when it detects these scenarios!
