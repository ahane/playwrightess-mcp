# Project-Specific Browser Scripts

This document covers how to create, organize, and use project-specific browser automation scripts with playwright-stateful.

## IMPORTANT: Always Check for Existing Scripts

**When starting a session, ALWAYS check the `.claude/browser/` directory first for project-specific scripts and saved sessions.**

Projects can define reusable browser automation scripts in `.claude/browser/`:

```
.claude/
├── browser/
│   ├── sessions/
│   │   ├── authenticated.js      # Pre-configured authenticated session
│   │   ├── admin-login.js        # Admin user session
│   │   └── test-user.js          # Test user session
│   ├── scripts/
│   │   ├── setup-test-data.js    # Create test fixtures
│   │   ├── clear-cache.js        # Clear browser cache/cookies
│   │   └── screenshot-flow.js    # Capture user flow screenshots
│   └── README.md                 # Project-specific documentation
```

## Discovery Workflow

**Always perform discovery when starting a session:**

```bash
# Step 1: Check for project scripts
ls -la .claude/browser/sessions/
ls -la .claude/browser/scripts/

# Step 2: List available sessions
cat .claude/browser/README.md  # Read project documentation

# Step 3: Ask user which session to use (if multiple available)
# Or auto-select if only one exists
```

**For complete discovery protocol, see `DISCOVERY.md`** - includes decision trees, error handling, and detailed examples.

## Session Scripts

Session scripts set up a pre-configured browser state (logged in, with test data, etc.):

**Example: `.claude/browser/sessions/authenticated.js`**

```javascript
// Login as default test user
await page.goto('http://localhost:3000/login');
await page.fill('#email', 'test@example.com');
await page.fill('#password', 'testpass123');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard');

console.log('✓ Authenticated as test@example.com');
```

**Usage:**

```bash
# Start session
node dist/cli.js start

# Load the authenticated session
node dist/cli.js eval "$(cat .claude/browser/sessions/authenticated.js)"

# Now you're logged in and ready to work
node dist/cli.js eval "await page.goto('http://localhost:3000/admin')"
```

## Utility Scripts

Utility scripts perform common tasks:

**Example: `.claude/browser/scripts/setup-test-data.js`**

```javascript
// Create test data for development
sharedState.testData = {
  users: [],
  posts: []
};

// Create 5 test users
for (let i = 1; i <= 5; i++) {
  await page.goto('http://localhost:3000/admin/users/new');
  await page.fill('#name', `Test User ${i}`);
  await page.fill('#email', `user${i}@example.com`);
  await page.click('button:has-text("Create")');

  const userId = await page.textContent('.user-id');
  sharedState.testData.users.push({ id: userId, name: `Test User ${i}` });
}

console.log('✓ Created test users:', sharedState.testData.users.length);
```

**Example: `.claude/browser/scripts/screenshot-flow.js`**

```javascript
// Capture screenshots of entire user flow
const flowName = sharedState.flowName || 'default';
const screenshotDir = `/tmp/flows/${flowName}`;

await page.goto('http://localhost:3000');
await page.screenshot({ path: `${screenshotDir}/01-home.png`, fullPage: true });

await page.click('a[href="/signup"]');
await page.screenshot({ path: `${screenshotDir}/02-signup.png`, fullPage: true });

await page.fill('#name', 'Demo User');
await page.fill('#email', 'demo@example.com');
await page.screenshot({ path: `${screenshotDir}/03-filled.png`, fullPage: true });

console.log(`✓ Screenshots saved to ${screenshotDir}/`);
```

## Project README Template

**Example: `.claude/browser/README.md`**

```markdown
# Browser Automation Scripts

## Available Sessions

### `sessions/authenticated.js`
Logs in as `test@example.com` (password: `testpass123`)
Use for: General testing, API exploration

### `sessions/admin-login.js`
Logs in as admin user `admin@example.com` (password: `adminpass`)
Use for: Admin panel testing, user management

### `sessions/test-user.js`
Logs in as test user with pre-populated data
Use for: Testing user-facing features

## Available Scripts

### `scripts/setup-test-data.js`
Creates 5 test users and 10 test posts
Run after: Database reset
Results: Populates `sharedState.testData`

### `scripts/clear-cache.js`
Clears all browser cache, cookies, and localStorage
Run when: Testing fresh user experience

### `scripts/screenshot-flow.js`
Captures screenshots of the signup → onboarding flow
Results: Saves to `/tmp/flows/<flowName>/`

## Environment

- Development server: `http://localhost:3000`
- API endpoint: `http://localhost:3000/api`
- Test credentials in: `cypress/fixtures/users.json`

## Common Workflows

### Workflow 1: Test New Feature
```bash
node dist/cli.js start
node dist/cli.js eval "$(cat .claude/browser/sessions/authenticated.js)"
node dist/cli.js eval "await page.goto('http://localhost:3000/new-feature')"
# Test the feature...
node dist/cli.js stop
```

### Workflow 2: Create Test Data
```bash
node dist/cli.js start
node dist/cli.js eval "$(cat .claude/browser/sessions/admin-login.js)"
node dist/cli.js eval "$(cat .claude/browser/scripts/setup-test-data.js)"
node dist/cli.js eval "console.log(sharedState.testData)"
node dist/cli.js stop
```

### Workflow 3: Capture Flow Screenshots
```bash
node dist/cli.js start
node dist/cli.js eval "sharedState.flowName = 'signup-v2'"
node dist/cli.js eval "$(cat .claude/browser/scripts/screenshot-flow.js)"
node dist/cli.js stop
```
```

## Using Project Scripts with Claude

When Claude starts a browser session, it should:

1. **Check for `.claude/browser/` directory**
2. **Read `.claude/browser/README.md`** if it exists
3. **List available sessions** in `sessions/`
4. **List available scripts** in `scripts/`
5. **Ask user which session to load** (or use default)
6. **Execute the session script** to set up state
7. **Proceed with the task**

**Example interaction:**

```
User: "Use playwright-stateful to test the new checkout flow"

Claude:
- Checking .claude/browser/ directory...
- Found: sessions/authenticated.js, sessions/admin-login.js
- Found: scripts/setup-test-data.js, scripts/clear-cache.js
- Starting session with authenticated.js...
- ✓ Logged in as test@example.com
- Navigating to checkout flow...
```

## Creating New Project Scripts

When creating scripts for a project:

**1. Create directory structure:**

```bash
mkdir -p .claude/browser/sessions
mkdir -p .claude/browser/scripts
```

**2. Add to `.gitignore` (optional):**

```bash
echo ".claude/browser/*.state.json" >> .gitignore  # Ignore session state files
```

**3. Document in README:**

Always create `.claude/browser/README.md` explaining:
- What sessions are available
- What scripts do
- Common workflows
- Environment details (URLs, credentials)

**4. Use consistent patterns:**

- Sessions should end with user logged in and ready
- Scripts should use `sharedState` for results
- Always `console.log` success/failure
- Include error handling

## Benefits of Project Scripts

✅ **Team Collaboration** - Share common workflows
✅ **Faster Onboarding** - New developers get pre-built automation
✅ **Consistency** - Everyone uses the same test data setup
✅ **Documentation** - Scripts serve as executable documentation
✅ **Reusability** - Common tasks become one-liners

## Advanced: Parameterized Scripts

Scripts can accept parameters via `sharedState`:

**`.claude/browser/scripts/create-user.js`**

```javascript
// Expects: sharedState.userName, sharedState.userEmail
const name = sharedState.userName || 'Default User';
const email = sharedState.userEmail || 'default@example.com';

await page.goto('http://localhost:3000/admin/users/new');
await page.fill('#name', name);
await page.fill('#email', email);
await page.click('button:has-text("Create")');

const userId = await page.textContent('.user-id');
sharedState.createdUserId = userId;

console.log(`✓ Created user: ${name} (${userId})`);
```

**Usage:**

```bash
node dist/cli.js start
node dist/cli.js eval "sharedState.userName = 'Alice'; sharedState.userEmail = 'alice@example.com'"
node dist/cli.js eval "$(cat .claude/browser/scripts/create-user.js)"
node dist/cli.js eval "console.log('User ID:', sharedState.createdUserId)"
```

## Script Best Practices

1. **Always log what the script does** - Use `console.log` liberally
2. **Use sharedState for input/output** - Make scripts composable
3. **Handle errors gracefully** - Wrap in try/catch if needed
4. **Document parameters** - Comment what sharedState vars are expected
5. **Keep scripts focused** - One task per script
6. **Version control them** - Commit to the repository
7. **Test regularly** - Ensure scripts work as app evolves

## Examples

See `examples/claude-browser/` directory for complete templates you can copy and customize for your project.
