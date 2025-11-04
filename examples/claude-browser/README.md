# Browser Automation Scripts

This directory contains project-specific browser automation scripts for use with the playwright-stateful skill.

**Note:** This is an example template. Copy to your project's `.claude/browser/` directory and customize for your application.

## Directory Structure

```
.claude/browser/
├── sessions/          # Pre-configured login sessions
├── scripts/           # Utility scripts for common tasks
└── README.md          # This file
```

## Available Sessions

### `sessions/example-login.js`

Logs in as a demo user.

**Credentials:**
- Email: `demo@example.com`
- Password: `demopass123`

**Use for:**
- General testing
- Exploring authenticated features
- API endpoint testing

**Result:**
- Sets `sharedState.currentUser` with logged-in user info

**Usage:**
```bash
node dist/cli.js start
node dist/cli.js eval "$(cat .claude/browser/sessions/example-login.js)"
```

---

## Available Scripts

### `scripts/setup-test-data.js`

Creates test data via the admin UI:
- 3 test users (testuser1-3@example.com)
- 5 test items with prices

**Requirements:**
- Must be logged in as admin
- Admin panel must be accessible at `/admin`

**Results:**
- Populates `sharedState.testData.users` (array of user objects)
- Populates `sharedState.testData.items` (array of item objects)

**When to run:**
- After database reset
- Before running integration tests
- When setting up demo environment

**Usage:**
```bash
node dist/cli.js start
node dist/cli.js eval "$(cat .claude/browser/sessions/admin-login.js)"
node dist/cli.js eval "$(cat .claude/browser/scripts/setup-test-data.js)"
node dist/cli.js eval "console.log(sharedState.testData)"
```

---

### `scripts/screenshot-flow.js`

Captures screenshots of the product browsing → checkout flow.

**Parameters:**
- `sharedState.flowName` - Name for this flow capture (default: "default-flow")

**Screenshots captured:**
1. Home page
2. Product listing
3. Product detail
4. Added to cart notification
5. Cart view
6. Checkout page

**Results:**
- Screenshots saved to `/tmp/flows/<flowName>/`
- Sets `sharedState.lastFlowCapture` with metadata

**When to use:**
- Documenting user flows
- Visual regression testing
- Creating onboarding guides
- Bug reports

**Usage:**
```bash
node dist/cli.js start
node dist/cli.js eval "sharedState.flowName = 'checkout-v2'"
node dist/cli.js eval "$(cat .claude/browser/scripts/screenshot-flow.js)"
node dist/cli.js eval "console.log(sharedState.lastFlowCapture)"
```

---

### `scripts/clear-cache.js`

Clears all browser storage to simulate fresh user experience.

**What it clears:**
- Cookies
- localStorage
- sessionStorage
- IndexedDB
- Optionally clears `sharedState` (set `sharedState.clearSharedState = true`)

**When to use:**
- Testing first-time user experience
- Debugging cache-related issues
- Resetting between test runs

**Usage:**
```bash
node dist/cli.js eval "sharedState.clearSharedState = true"
node dist/cli.js eval "$(cat .claude/browser/scripts/clear-cache.js)"
```

---

## Environment Configuration

**Development Server:**
- URL: `http://localhost:3000`
- API: `http://localhost:3000/api`

**Test Credentials:**

| Role  | Email                  | Password     |
|-------|------------------------|--------------|
| User  | demo@example.com       | demopass123  |
| Admin | admin@example.com      | adminpass    |

**Note:** Update these for your actual project!

---

## Common Workflows

### Workflow 1: Test New Feature

Test a new feature with authenticated session:

```bash
# Start session and login
node dist/cli.js start
node dist/cli.js eval "$(cat .claude/browser/sessions/example-login.js)"

# Navigate to feature
node dist/cli.js eval "await page.goto('http://localhost:3000/new-feature')"

# Test interactions
node dist/cli.js eval "await page.click('button.test-action')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/feature-test.png'})"

# Stop session
node dist/cli.js stop
```

### Workflow 2: Create Fresh Test Environment

Reset everything and create test data:

```bash
# Start session
node dist/cli.js start

# Clear all cache
node dist/cli.js eval "sharedState.clearSharedState = true"
node dist/cli.js eval "$(cat .claude/browser/scripts/clear-cache.js)"

# Login as admin
node dist/cli.js eval "$(cat .claude/browser/sessions/admin-login.js)"

# Create test data
node dist/cli.js eval "$(cat .claude/browser/scripts/setup-test-data.js)"

# Verify
node dist/cli.js eval "console.log('Users:', sharedState.testData.users.length)"
node dist/cli.js eval "console.log('Items:', sharedState.testData.items.length)"

# Stop
node dist/cli.js stop
```

### Workflow 3: Document User Journey

Capture screenshots of entire user flow:

```bash
# Start fresh session
node dist/cli.js start
node dist/cli.js eval "$(cat .claude/browser/scripts/clear-cache.js)"

# Set flow name
node dist/cli.js eval "sharedState.flowName = 'user-journey-v3'"

# Capture flow
node dist/cli.js eval "$(cat .claude/browser/scripts/screenshot-flow.js)"

# Check results
node dist/cli.js eval "console.log('Saved to:', sharedState.lastFlowCapture.directory)"

# Stop
node dist/cli.js stop
```

### Workflow 4: Debug State Issue

Incrementally debug a state management problem:

```bash
# Start and login
node dist/cli.js start
node dist/cli.js eval "$(cat .claude/browser/sessions/example-login.js)"

# Navigate to problem area
node dist/cli.js eval "await page.goto('http://localhost:3000/problem-page')"

# Check React state (if React app)
node dist/cli.js eval "
  const state = await page.evaluate(() => {
    const el = document.querySelector('[data-component=\"ProblemComponent\"]');
    const fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
    return fiber.memoizedState.memoizedState;
  });
  console.log('Component state:', state);
"

# Try interaction
node dist/cli.js eval "await page.click('button.trigger-bug')"

# Check state again
node dist/cli.js eval "<repeat state check>"

# Continue debugging...
```

---

## Creating New Scripts

When adding scripts to your project:

### 1. Script Template

```javascript
// Brief description of what this script does
// List any prerequisites (logged in, specific page, etc.)

console.log('Starting <script-name>...');

// Initialize sharedState if needed
if (!sharedState.myData) {
  sharedState.myData = {};
}

// Your automation logic here
await page.goto('http://localhost:3000/...');
// ...

// Log results
console.log('✓ <script-name> completed');

// Save results to sharedState
sharedState.myScriptResult = {
  // ... data
};
```

### 2. Documentation Guidelines

Always document in this README:
- What the script does
- Prerequisites (login required? specific page?)
- Parameters (via `sharedState`)
- Results (what it saves to `sharedState`)
- When to use it
- Example usage

### 3. Best Practices

✅ **Use descriptive names**: `setup-checkout-test-data.js` not `script1.js`
✅ **Log progress**: Use `console.log` at each major step
✅ **Handle errors**: Wrap risky operations in try/catch
✅ **Document parameters**: Comment expected `sharedState` vars
✅ **Return results**: Save outcomes to `sharedState`
✅ **Keep focused**: One task per script
✅ **Version control**: Commit scripts to repository

---

## Customizing for Your Project

To adapt these examples for your project:

1. **Copy to `.claude/browser/`:**
   ```bash
   cp -r examples/claude-browser/* .claude/browser/
   ```

2. **Update session scripts:**
   - Change URLs to match your app
   - Update selectors for your forms
   - Use your actual test credentials

3. **Update utility scripts:**
   - Modify data creation logic for your models
   - Adjust screenshot flow for your user journey
   - Update cache clearing if using custom storage

4. **Update this README:**
   - Document your actual endpoints
   - List your real test credentials (or reference where they are)
   - Add project-specific workflows
   - Document any custom scripts

5. **Test everything:**
   ```bash
   node dist/cli.js start
   node dist/cli.js eval "$(cat .claude/browser/sessions/<your-session>.js)"
   node dist/cli.js stop
   ```

---

## Tips for Claude Integration

When working with Claude:

**Discovery happens automatically:**
```
User: "Test the checkout flow"

Claude:
- Checking .claude/browser/ directory...
- Found sessions: example-login.js
- Found scripts: setup-test-data.js, screenshot-flow.js, clear-cache.js
- Starting session with example-login.js...
```

**Ask Claude to use specific scripts:**
```
User: "Run the setup-test-data script"
User: "Capture screenshots of the signup flow"
User: "Clear the cache and test as a new user"
```

**Claude will:**
1. Check for `.claude/browser/README.md` first
2. List available sessions and scripts
3. Ask which to use (or auto-select if only one)
4. Execute and report results

---

## Troubleshooting

**Script fails with "element not found":**
- Selectors may have changed
- Update script selectors to match current HTML
- Use `await page.screenshot({path: '/tmp/debug.png'})` to inspect

**Session doesn't persist:**
- Ensure storage state is saved: `node dist/cli.js stop`
- Check `.playwright-session/` directory exists
- Verify `shared-storage-state.json` is being created

**Scripts work locally but fail in CI:**
- Add appropriate waits: `await page.waitForSelector(...)`
- Increase timeouts if needed
- Ensure test data is seeded properly

---

## Further Reading

- See `WORKFLOWS.md` for more workflow examples
- See `REACT-INSPECTION.md` for React debugging techniques
- See main `SKILL.md` for complete documentation
