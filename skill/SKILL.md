---
name: playwright-stateful
description: Maintains persistent Playwright browser sessions with state across executions. Automatically checks .claude/browser/ for project-specific sessions. Use for multi-step workflows, persistent logins, incremental debugging, stateful scraping, or testing multiple user roles simultaneously with isolated browser contexts.
---

# Playwright Stateful - Persistent Browser Automation

This skill provides a persistent Playwright browser environment where state is maintained between code executions. Unlike one-off scripts, this allows you to build complex multi-step browser workflows incrementally.

## Table of Contents

1. [When to Use This Skill](#when-to-use-this-skill)
2. [Core Concepts](#core-concepts)
3. [Installation](#installation)
4. [Project-Specific Browser Scripts](#project-specific-browser-scripts)
5. [Workflow](#workflow)
6. [Code Execution](#code-execution-details)
7. [Available APIs](#available-apis)
9. [Examples](#examples)
10. [Error Handling](#error-handling)
11. [Configuration](#configuration)
12. [Cleanup and Troubleshooting](#cleanup-and-troubleshooting)
13. [Best Practices](#best-practices)
14. [Development Style Guide](#development-style-guide)
15. [Limitations](#limitations)
16. [Common Workflows](#common-workflows)
17. [React App Inspection](#react-app-inspection)

## When to Use This Skill

Use this skill for:
- Multi-step workflows building on previous steps
- Persistent login sessions across operations
- Incremental debugging without browser restarts
- Stateful scraping maintaining browser context
- Testing multiple user roles simultaneously

Do NOT use for simple one-off checks or tasks needing fresh state each time.

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
npm install && npm run build
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

## Available APIs

**See `REFERENCE.md` for complete API documentation.**

Execution context includes:
- Playwright modules (`chromium`, `firefox`, `webkit`, `devices`)
- Node.js built-ins (`console`, timers, `Buffer`, `URL`, `process`)
- `sessionManager` - Browser session management
- `sharedState` - Persistent object for custom data

## Examples

### Login and Continue Session

```bash
# Start and login
node dist/cli.js start
node dist/cli.js eval "await page.goto('https://example.com/login')"
node dist/cli.js eval "await page.fill('#email', 'user@test.com'); await page.fill('#pass', 'pass123')"
node dist/cli.js eval "await page.click('button[type=submit]')"

# Navigate to protected page (still logged in!)
node dist/cli.js eval "await page.goto('https://example.com/profile')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/profile.png'})"

# Stop when done
node dist/cli.js stop
```

### Multi-Session Usage

```bash
# Start multiple isolated sessions
node dist/cli.js start --session admin
node dist/cli.js start --session user

# Each maintains independent state
node dist/cli.js eval "await page.goto('/admin')" --session admin
node dist/cli.js eval "await page.goto('/user')" --session user
```

**See `WORKFLOWS.md` for 10+ detailed workflows including:**
- Authentication debugging
- Stateful scraping
- Form testing
- Multi-session role testing

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

See `DEVELOPMENT-GUIDE.md` for comprehensive development practices.

**Key Guidelines:**

1. **Always log transient elements** (toasts, notifications, modals) - screenshots will miss them
2. **Verify element existence** before interaction to avoid errors
3. **Batch operations** to reduce HTTP round-trips (faster execution)
4. **Prefix logs with session IDs** when using multiple sessions (`[ADMIN]`, `[USER]`)

**Quick Example:**
```bash
# ✅ Capture toast before screenshot
node dist/cli.js eval "
  await page.click('#save');
  const toast = await page.locator('.toast').textContent();
  console.log('Save result:', toast);
"
```

The guide includes verification patterns, debugging workflows, common mistakes, and performance tips.

## Limitations

- Non-tracked variables don't persist between executions
- Large objects in sharedState consume memory per session
- Each session requires separate browser process (resource intensive for many sessions)
- Browser stays open consuming resources until explicitly stopped
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

For implementation details, see `REFERENCE.md`.
