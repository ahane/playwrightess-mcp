---
name: playwright-stateful
description: Persistent Playwright browser automation with state across executions. ALWAYS check .claude/browser/ first for project sessions. Use for multi-step workflows, persistent logins, incremental debugging, or stateful scraping requiring maintained browser context.
---

# Playwright Stateful - Persistent Browser Automation

This skill provides a persistent Playwright browser environment where state is maintained between code executions. Unlike one-off scripts, this allows you to build complex multi-step browser workflows incrementally.

## Table of Contents

1. [When to Use This Skill](#when-to-use-this-skill)
2. [Core Concepts](#core-concepts)
3. [Installation](#installation)
4. [Project-Specific Browser Scripts](#project-specific-browser-scripts)
5. [Workflow](#workflow)
6. [Code Execution Details](#code-execution-details)
7. [Token Efficiency](#token-efficiency)
8. [Available APIs](#available-apis)
9. [Examples](#examples)
10. [Error Handling](#error-handling)
11. [Configuration](#configuration)
12. [Cleanup and Troubleshooting](#cleanup-and-troubleshooting)
13. [Best Practices](#best-practices)
14. [Development Style Guide](#development-style-guide)
15. [Limitations](#limitations)
16. [Common Workflows](#common-workflows)
17. [React App Inspection](#react-app-inspection)
18. [Technical Details](#technical-details)

## When to Use This Skill

Use this skill when you need:
- **Multi-step workflows** where each step builds on the previous one
- **Persistent login sessions** that survive between operations
- **Incremental debugging** of browser automation without restarting
- **Stateful scraping** where browser context must be maintained
- **Interactive development** of complex browser automation

Do NOT use for:
- Simple one-off browser checks (use regular playwright skill instead)
- Visual verification of your own work (use playwright skill)
- Tasks that benefit from fresh browser state each time

## Core Concepts

### Persistent Session

A single browser instance stays running across multiple code executions. Variables like `page`, `browser`, and `context` persist automatically.

### Code Snippet Execution

Execute small JavaScript snippets against the persistent browser. Each execution returns results and console logs.

### Automatic State Tracking

Key variables (`page`, `browser`, `context`, `sessionManager`, `sharedState`) are automatically persisted between executions using AST rewriting.

### Storage State Persistence

Browser cookies, localStorage, and session data are saved to disk and restored between sessions.

### Multi-Session Support

Run multiple isolated browser sessions simultaneously, each with separate:
- User data directory (`.playwright-sessions/<sessionId>/`)
- Storage state file (`.playwright-storage-states/<sessionId>-state.json`)
- Browser context, pages, and cookies
- VM execution context

Use `--session <name>` parameter to specify which session to use. Sessions are isolated and can maintain different logins or browser states.

## Installation

```bash
npm install && npm run build  # Creates dist/cli.js
```

## Project-Specific Browser Scripts

**ALWAYS check `.claude/browser/` directory first for project scripts!**

Projects define reusable sessions and scripts in `.claude/browser/`:
```
.claude/browser/
├── sessions/      # Pre-configured login sessions
├── scripts/       # Utility scripts (setup data, screenshots, etc.)
└── README.md      # Documentation
```

**Discovery workflow:**
```bash
ls .claude/browser/sessions/              # Check available sessions
cat .claude/browser/README.md             # Read documentation
node dist/cli.js eval "$(cat .claude/browser/sessions/authenticated.js)"
```

**See `PROJECT-SCRIPTS.md` for complete guide:**
- Directory structure and conventions
- Discovery workflow (automatic session detection)
- Creating session scripts (login, setup, etc.)
- Creating utility scripts (test data, screenshots)
- Project README templates
- Best practices and patterns
- Example templates in `examples/claude-browser/`

## Workflow

### Step 1: Start a Persistent Session

```bash
# Start default session
node dist/cli.js start

# Start named session
node dist/cli.js start --session user1
```

This launches a persistent browser and returns a session ID. The browser stays open in the background.

**Returns:**
```json
{
  "success": true,
  "sessionId": "user1",
  "message": "Session 'user1' started"
}
```

**Multiple Sessions:**
```bash
# Start multiple isolated sessions
node dist/cli.js start --session admin
node dist/cli.js start --session user1
node dist/cli.js start --session user2

# List active sessions
node dist/cli.js sessions
# Returns: {"success": true, "sessions": ["admin", "user1", "user2"], "count": 3}
```

### Step 2: Execute Code Snippets

```bash
# Execute in default session
node dist/cli.js eval "await page.goto('http://example.com')"

# Execute in named session
node dist/cli.js eval "await page.goto('http://example.com')" --session user1
```

**Returns:**
```json
{
  "success": true,
  "result": null,
  "browserConsoleLogs": [],
  "sessionConsoleLogs": [],
  "sessionId": "user1"
}
```

Execute multiple commands incrementally:

```bash
# Navigate
node dist/cli.js eval "await page.goto('http://example.com/login')"

# Fill form (page variable persists from previous call)
node dist/cli.js eval "await page.fill('#username', 'test')"

# Submit
node dist/cli.js eval "await page.click('#submit')"

# Take screenshot
node dist/cli.js eval "await page.screenshot({path: '/tmp/logged_in.png'})"

# Navigate to protected page (still logged in!)
node dist/cli.js eval "await page.goto('http://example.com/dashboard')"
```

**Multi-Session Example:**
```bash
# Admin session: Login as admin
node dist/cli.js eval "await page.goto('http://app.com/login')" --session admin
node dist/cli.js eval "await page.fill('#user', 'admin'); await page.fill('#pass', 'admin123')" --session admin
node dist/cli.js eval "await page.click('#login')" --session admin

# User session: Login as regular user
node dist/cli.js eval "await page.goto('http://app.com/login')" --session user1
node dist/cli.js eval "await page.fill('#user', 'user1'); await page.fill('#pass', 'user123')" --session user1
node dist/cli.js eval "await page.click('#login')" --session user1

# Both sessions remain logged in independently
node dist/cli.js eval "console.log('Admin:', page.url())" --session admin
node dist/cli.js eval "console.log('User:', page.url())" --session user1
```

### Step 3: Use Shared State

The `sharedState` object persists data between executions:

```bash
# Store data
node dist/cli.js eval "sharedState.userData = await page.textContent('#user-name')"

# Use it later
node dist/cli.js eval "console.log('User:', sharedState.userData)"
```

### Step 4: Stop the Session

```bash
# Stop default session
node dist/cli.js stop

# Stop specific session
node dist/cli.js stop --session user1

# Shutdown entire server (all sessions)
node dist/cli.js shutdown
```

This closes the browser and saves state to disk. The `shutdown` command stops all sessions and the background server.

## Tracked Variables

These variables automatically persist between executions:

- `page` - Current Playwright page
- `browser` - Playwright browser instance
- `context` - Browser context
- `sessionManager` - Singleton session manager
- `sharedState` - Object for custom data (initially `{}`)

Other variables are NOT tracked and will be lost between executions.

## Code Execution Details

### Automatic Wrapping

Code is automatically wrapped in an async IIFE, so top-level await works:

```bash
# You write:
node dist/cli.js eval "const html = await page.content(); console.log(html)"

# Executes as:
# (async () => {
#   const html = await page.content();
#   globalThis.html = html;  // Auto-tracked if it's a tracked variable
#   console.log(html);
# })()
```

### Variable Persistence via AST Rewriting

When you assign to tracked variables, they're automatically persisted:

```bash
# You write:
node dist/cli.js eval "const page = await browser.newPage()"

# Gets rewritten to:
# const page = await browser.newPage();
# globalThis.page = page;  // Auto-injected!
```

This happens transparently via Babel AST transformation.

### Console Capture

Both browser console and execution console are captured:

```bash
node dist/cli.js eval "
  console.log('From executor');
  await page.evaluate(() => console.log('From browser'));
"
```

Returns both sets of logs in the response.

## Token Efficiency

This skill is optimized for token efficiency when used by AI agents:

**DO NOT:**
- ❌ Use `waitForLoadState('networkidle')` (wastes time and tokens)
- ❌ Use `waitForSelector()` (same reason)
- ❌ Add code comments in eval strings
- ❌ Add unnecessary whitespace

**DO:**
- ✅ Use direct navigation and actions
- ✅ Use short, focused code snippets
- ✅ Save screenshots to `/tmp/` directory
- ✅ Use 8-second timeouts (already configured)

## Available APIs

**See `REFERENCE.md` for complete API documentation.**

Execution context includes:
- Playwright modules (`chromium`, `firefox`, `webkit`, `devices`)
- Node.js built-ins (`console`, timers, `Buffer`, `URL`, `process`)
- `sessionManager` - Browser session management
- `sharedState` - Persistent object for custom data

## Examples

### Multi-Step Login Flow

```bash
# Start session
node dist/cli.js start

# Navigate to login
node dist/cli.js eval "await page.goto('https://example.com/login')"

# Fill credentials
node dist/cli.js eval "await page.fill('#email', 'user@example.com')"
node dist/cli.js eval "await page.fill('#password', 'password123')"

# Submit
node dist/cli.js eval "await page.click('button[type=submit]')"

# Wait for navigation
node dist/cli.js eval "await page.waitForURL('**/dashboard')"

# Screenshot logged-in state
node dist/cli.js eval "await page.screenshot({path: '/tmp/dashboard.png'})"

# Navigate to another page (still logged in)
node dist/cli.js eval "await page.goto('https://example.com/profile')"

# Stop session
node dist/cli.js stop
```

### Scraping with State

```bash
# Start
node dist/cli.js start

# Initialize shared state
node dist/cli.js eval "sharedState.products = []"

# Navigate to product list
node dist/cli.js eval "await page.goto('https://shop.example.com/products')"

# Extract products
node dist/cli.js eval "
  const items = await page.$$eval('.product', els =>
    els.map(el => ({
      name: el.querySelector('.name').textContent,
      price: el.querySelector('.price').textContent
    }))
  );
  sharedState.products.push(...items);
"

# Navigate to next page
node dist/cli.js eval "await page.click('.next-page')"

# Extract more products (adds to existing array)
node dist/cli.js eval "
  const items = await page.$$eval('.product', els =>
    els.map(el => ({
      name: el.querySelector('.name').textContent,
      price: el.querySelector('.price').textContent
    }))
  );
  sharedState.products.push(...items);
"

# Get final count
node dist/cli.js eval "console.log('Total products:', sharedState.products.length)"

# Stop
node dist/cli.js stop
```

### Debugging Browser Automation

```bash
# Start with visible browser
node dist/cli.js start

# Try navigation
node dist/cli.js eval "await page.goto('https://example.com')"

# Check what's on page
node dist/cli.js eval "console.log(await page.title())"

# Try selector
node dist/cli.js eval "const btn = await page.$('button'); console.log('Found:', !!btn)"

# Adjust selector and try again (browser still open)
node dist/cli.js eval "const btn = await page.$('.submit-btn'); console.log('Found:', !!btn)"

# Take screenshot to visually inspect
node dist/cli.js eval "await page.screenshot({path: '/tmp/debug.png'})"

# Continue debugging...
```

### Multi-Session Testing

Test different user roles or scenarios in parallel:

```bash
# Setup: Start multiple sessions
node dist/cli.js start --session admin
node dist/cli.js start --session user
node dist/cli.js start --session guest

# Admin: Login with admin credentials
node dist/cli.js eval "await page.goto('http://app.com/login')" --session admin
node dist/cli.js eval "await page.fill('#user', 'admin@test.com'); await page.fill('#pass', 'admin'); await page.click('#login')" --session admin

# User: Login with user credentials
node dist/cli.js eval "await page.goto('http://app.com/login')" --session user
node dist/cli.js eval "await page.fill('#user', 'user@test.com'); await page.fill('#pass', 'user'); await page.click('#login')" --session user

# Guest: Browse without login
node dist/cli.js eval "await page.goto('http://app.com')" --session guest

# Test: Verify each role sees correct content
node dist/cli.js eval "const hasAdminPanel = await page.$('.admin-panel'); console.log('Admin panel visible:', !!hasAdminPanel)" --session admin
node dist/cli.js eval "const hasAdminPanel = await page.$('.admin-panel'); console.log('Admin panel visible:', !!hasAdminPanel)" --session user
node dist/cli.js eval "const loginPrompt = await page.$('.login-required'); console.log('Login required:', !!loginPrompt)" --session guest

# Cleanup: Stop all sessions
node dist/cli.js stop --session admin
node dist/cli.js stop --session user
node dist/cli.js stop --session guest

# Or shutdown entire server
node dist/cli.js shutdown
```

## Error Handling

Errors are returned in the response:

```bash
node dist/cli.js eval "await page.goto('invalid-url')"
```

Returns:
```json
{
  "success": false,
  "error": "net::ERR_NAME_NOT_RESOLVED at invalid-url",
  "consoleLogs": [],
  "browserConsoleLogs": []
}
```

The session continues running even after errors.

## Configuration

### Browser Settings

Default configuration (in session manager):
- Browser: Chromium
- Headless: false (visible browser)
- Viewport: 1280x720
- User data dir: `.playwright-session/`
- Storage state: `shared-storage-state.json`
- Timeout: 8 seconds

### Customizing Timeouts

```bash
node dist/cli.js eval "page.setDefaultTimeout(15000)"
```

### Launch Different Browser

```bash
node dist/cli.js eval "
  const browser = await firefox.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
"
```

## Cleanup and Troubleshooting

### Kill Stray Processes

If browser processes get stuck:

```bash
# Kill all Chromium processes
pkill -f chromium

# Or kill specific session
node dist/cli.js stop
```

### Clear Session Data

```bash
rm -rf .playwright-session/
rm shared-storage-state.json
```

### Start Fresh Session

```bash
node dist/cli.js stop
rm -rf .playwright-session/ shared-storage-state.json
node dist/cli.js start
```

## Best Practices

1. **Always stop sessions** when done to prevent resource leaks
2. **Use sharedState** for data that needs to persist between executions
3. **Keep code snippets focused** - one operation per execution
4. **Capture screenshots** liberally for debugging
5. **Check errors** in response before continuing workflow
6. **Save storage state** before stopping to preserve login sessions

## Development Style Guide

### Handling Transient UI Elements

**Critical: Always log quickly disappearing elements like toasts, notifications, and modals**

Screenshots will miss elements that disappear automatically. Instead, capture their content to console:

```bash
# ❌ BAD: Screenshot might miss the toast
node dist/cli.js eval "await page.click('#save'); await page.screenshot({path: 'result.png'})"

# ✅ GOOD: Log the toast text before it disappears
node dist/cli.js eval "
  await page.click('#save');
  const toast = await page.locator('.toast').textContent();
  console.log('Toast message:', toast);
"
```

**Transient elements to always log:**
- Toast notifications
- Success/error alerts that auto-dismiss
- Dropdown menus (close on click-outside)
- Tooltips (disappear on hover-out)
- Loading spinners (gone after load completes)
- Temporary modals/dialogs

### Verification Patterns

**Pattern 1: Capture transient feedback immediately**
```bash
node dist/cli.js eval "
  await page.click('#delete');

  // Capture confirmation toast before it disappears
  const toast = await page.waitForSelector('.toast', { timeout: 2000 });
  const message = await toast.textContent();
  console.log('Deletion result:', message);

  // Then take screenshot of final state
  await page.waitForTimeout(500);
  await page.screenshot({path: 'after-delete.png'});
"
```

**Pattern 2: Log element existence before interaction**
```bash
node dist/cli.js eval "
  // Log what's visible before clicking
  const buttonText = await page.textContent('button#submit');
  const isEnabled = await page.isEnabled('button#submit');
  console.log('Button state:', { text: buttonText, enabled: isEnabled });

  await page.click('button#submit');
"
```

**Pattern 3: Capture all notifications in sequence**
```bash
node dist/cli.js eval "
  // Listen for all toast notifications
  const toasts = [];
  page.on('console', msg => {
    if (msg.type() === 'log' && msg.text().includes('notification')) {
      toasts.push(msg.text());
    }
  });

  await page.click('#trigger-workflow');

  // Wait for process to complete
  await page.waitForSelector('.complete-indicator');

  console.log('All notifications:', toasts);
"
```

### Debugging Workflow

1. **Log state before actions** - Helps identify why actions fail
2. **Log results of actions** - Confirms what happened
3. **Log transient elements immediately** - Before they disappear
4. **Screenshot final states** - After transient elements are gone

```bash
# Example workflow
node dist/cli.js eval "console.log('Form state:', await page.$$eval('input', els => els.map(e => ({id: e.id, value: e.value}))))"
node dist/cli.js eval "await page.click('#submit')"
node dist/cli.js eval "console.log('Result toast:', await page.locator('.toast').textContent())"
node dist/cli.js eval "await page.screenshot({path: 'final.png'})"
```

### Common Mistakes to Avoid

**❌ Relying on screenshots for transient elements:**
```bash
# Toast appears and disappears in 3 seconds
node dist/cli.js eval "await page.click('#save')"
node dist/cli.js eval "await page.screenshot({path: 'result.png'})"  # Toast already gone!
```

**✅ Log transient, screenshot persistent:**
```bash
node dist/cli.js eval "
  await page.click('#save');
  const toast = await page.locator('.toast').textContent();
  console.log('Save result:', toast);
"
node dist/cli.js eval "await page.screenshot({path: 'result.png'})"  # Shows final state
```

**❌ Not verifying element existence:**
```bash
node dist/cli.js eval "await page.click('.submit-button')"  # Might not exist
```

**✅ Check existence and log state:**
```bash
node dist/cli.js eval "
  const button = await page.$('.submit-button');
  console.log('Submit button exists:', !!button);
  if (button) {
    await button.click();
  }
"
```

### Multi-Session Development Style

When working with multiple sessions, prefix console logs with session identifiers:

```bash
# Admin session
node dist/cli.js eval "
  console.log('[ADMIN] Navigating to admin panel');
  await page.goto('/admin');
  const users = await page.$$eval('.user-row', els => els.length);
  console.log('[ADMIN] Total users visible:', users);
" --session admin

# User session
node dist/cli.js eval "
  console.log('[USER] Navigating to admin panel');
  await page.goto('/admin');
  const denied = await page.textContent('.access-denied');
  console.log('[USER] Access result:', denied);
" --session user
```

### Performance Tips

1. **Avoid unnecessary waits** - Only wait for specific conditions
2. **Batch related operations** - Reduce HTTP round-trips to server
3. **Use short timeouts** - Default 8s is already optimized
4. **Clean up sessions** - Stop sessions when done to free resources

```bash
# ❌ Slow: Multiple round-trips
node dist/cli.js eval "await page.click('#btn1')"
node dist/cli.js eval "await page.click('#btn2')"
node dist/cli.js eval "await page.click('#btn3')"

# ✅ Fast: Single round-trip
node dist/cli.js eval "
  await page.click('#btn1');
  await page.click('#btn2');
  await page.click('#btn3');
"
```

## Limitations

- Only one session can run at a time (singleton pattern)
- Non-tracked variables don't persist between executions
- Large objects in sharedState consume memory
- Browser stays open consuming resources until stopped
- Code executes in VM sandbox with limited Node.js APIs

## Comparison with Regular Playwright Skill

| Feature | Playwright Stateful | Regular Playwright |
|---------|-------------------|-------------------|
| State persistence | ✅ Yes | ❌ No |
| Multi-step workflows | ✅ Easy | ❌ Requires full scripts |
| Login sessions | ✅ Persist | ❌ Lost between scripts |
| Resource usage | ⚠️ Higher (persistent) | ✅ Lower (ephemeral) |
| Use case | Complex workflows | One-off checks |
| Token efficiency | ✅ Optimized | ✅ Standard |

## Common Workflows

For detailed real-world development workflows, see `WORKFLOWS.md`:

- **Debugging Authentication Issues** - Incrementally debug login flows without restarting
- **Interactive SPA Exploration** - Explore complex apps while maintaining state
- **Multi-Step Form Testing** - Test checkout flows and wizard UIs naturally
- **Data Extraction from Protected Pages** - Scrape authenticated sites efficiently
- **Visual Regression Testing** - Capture screenshots across user flows
- **Recording User Flows** - Document user journeys with screenshots
- **API Response Interception** - Test UI with mocked backend responses
- **Building Test Fixtures** - Create complex test data through the UI
- **Production Monitoring** - Verify production sites with realistic flows
- **E2E Test Development** - Discover selectors and build tests incrementally

Each workflow includes complete code examples and explanations of why stateful sessions help.

## React App Inspection

For inspecting React applications, see `REACT-INSPECTION.md`:

- **Direct React Internals Access** - Access fiber tree without extensions
- **React DevTools Integration** - Use the browser extension programmatically
- **Component State Inspection** - View useState/class component state
- **Props and Context Inspection** - Examine component props and context values
- **Hooks Inspection** - Debug useState, useEffect, and custom hooks
- **Component Tree Navigation** - Find and traverse the component hierarchy
- **Performance Profiling** - Measure render times and identify bottlenecks

The persistent session is ideal for React debugging since you can inspect state as you interact with the app naturally.

## Technical Details

For implementation details, see:
- `src/session-manager.ts` - Browser session management
- `src/executor.ts` - Code execution with AST rewriting
- `src/cli.ts` - CLI interface
- `tsconfig.json` - TypeScript configuration
