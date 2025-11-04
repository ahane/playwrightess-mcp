# Statefulness: Playwright Stateful vs Naive Playwright

This document explains the core architectural difference between this stateful skill and a naive Playwright approach.

## The Problem with Naive Playwright

### Traditional Approach (Non-Stateful)

In a typical Playwright automation setup, each script execution starts fresh:

```javascript
// execution-1.js
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com/login');
await page.fill('#username', 'user');
await page.fill('#password', 'pass');
await page.click('#login');
await browser.close();
```

If you want to continue working on the next page, you need to:

```javascript
// execution-2.js
import { chromium } from 'playwright';

// ❌ Start completely fresh - login is LOST
const browser = await chromium.launch();
const page = await browser.newPage();

// Must login again!
await page.goto('https://example.com/login');
await page.fill('#username', 'user');
await page.fill('#password', 'pass');
await page.click('#login');

// Now navigate to dashboard
await page.goto('https://example.com/dashboard');
await page.screenshot({ path: 'dashboard.png' });
await browser.close();
```

### Problems with This Approach

1. **No Session Persistence**: Each script starts a new browser - cookies and login state are lost
2. **Repetitive Code**: Must repeat authentication in every script
3. **Slow Iteration**: Can't incrementally build workflows - must run full script each time
4. **No Interactive Development**: Can't pause, inspect, and continue
5. **Variable Scope Loss**: Variables don't survive between executions

## The Stateful Solution

### How This Skill Works

The playwright-stateful skill maintains a **persistent browser session** across multiple code executions:

```bash
# Execution 1: Login (browser stays open)
node dist/cli.js start
node dist/cli.js eval "await page.goto('https://example.com/login')"
node dist/cli.js eval "await page.fill('#username', 'user')"
node dist/cli.js eval "await page.fill('#password', 'pass')"
node dist/cli.js eval "await page.click('#login')"

# Execution 2: Continue with existing session ✅
# Browser is STILL OPEN, login is STILL VALID
node dist/cli.js eval "await page.goto('https://example.com/dashboard')"
node dist/cli.js eval "await page.screenshot({path: 'dashboard.png'})"

# Execution 3: Navigate to profile
node dist/cli.js eval "await page.goto('https://example.com/profile')"
node dist/cli.js eval "const name = await page.textContent('h1'); console.log(name)"
```

### Key Differences

| Aspect | Naive Playwright | Playwright Stateful |
|--------|------------------|---------------------|
| **Browser Lifecycle** | New browser per script | Single persistent browser |
| **Login State** | Lost between executions | Maintained across executions |
| **Cookies** | Gone after script ends | Persisted to disk |
| **Variables** | Script-scoped only | Automatically persisted |
| **Development Flow** | Write full script, run, repeat | Incremental: run → inspect → continue |
| **Multi-step Workflows** | Must be in one script | Can split across many executions |
| **Debugging** | Restart from beginning | Resume from where you left off |

## Technical Implementation

### Naive Playwright: Script-Scoped Variables

```javascript
// script.js
const browser = await chromium.launch();
const page = await browser.newPage();
// ... do stuff ...
await browser.close();

// Variables 'browser' and 'page' are destroyed when script ends
```

When the script ends, **everything is lost**.

### Playwright Stateful: AST Rewriting + VM Persistence

```javascript
// You write:
const page = await context.newPage();

// Gets automatically rewritten to:
const page = await context.newPage();
globalThis.page = page;  // ← Persisted to global scope!
```

The skill uses:
1. **Babel AST Rewriting**: Automatically tracks specific variables
2. **Node.js VM Context**: Creates a persistent execution environment
3. **Background HTTP Server**: Keeps the VM context alive between CLI calls
4. **Storage State**: Saves cookies/localStorage to disk

```typescript
// Simplified internal architecture
class MultiExecutor {
  private contexts: Map<string, vm.Context> = new Map();

  async execute(sessionId: string, code: string) {
    // Get or create persistent context for this session
    let context = this.contexts.get(sessionId);

    // Rewrite code to track variables
    const rewrittenCode = rewriteCodeToTrackVariables(code);

    // Execute in persistent context
    const result = vm.runInContext(rewrittenCode, context);

    // Context stays alive! Variables persist!
    return result;
  }
}
```

## Real-World Example: Debugging a Form

### Naive Approach

```javascript
// attempt-1.js - Try to submit form
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://app.com/form');
await page.fill('#field1', 'value1');
await page.click('#submit');
// ❌ Error: field2 is required
await browser.close();

// attempt-2.js - Start over, add field2
const browser = await chromium.launch();  // ← Start fresh again
const page = await browser.newPage();
await page.goto('https://app.com/form');
await page.fill('#field1', 'value1');
await page.fill('#field2', 'value2');  // ← Added this
await page.click('#submit');
// ❌ Error: field3 is required
await browser.close();

// attempt-3.js - Start over again, add field3
// ... repeat entire process AGAIN ...
```

Every attempt requires **restarting from scratch**.

### Stateful Approach

```bash
# Attempt 1: Navigate and start filling form
node dist/cli.js start
node dist/cli.js eval "await page.goto('https://app.com/form')"
node dist/cli.js eval "await page.fill('#field1', 'value1')"
node dist/cli.js eval "await page.click('#submit')"
# ❌ Error: field2 is required

# Attempt 2: Form is still there! Just add the missing field
node dist/cli.js eval "await page.fill('#field2', 'value2')"
node dist/cli.js eval "await page.click('#submit')"
# ❌ Error: field3 is required

# Attempt 3: Still on same page, add another field
node dist/cli.js eval "await page.fill('#field3', 'value3')"
node dist/cli.js eval "await page.click('#submit')"
# ✅ Success!

# Take screenshot of success page
node dist/cli.js eval "await page.screenshot({path: 'success.png'})"
```

The browser **stayed open** the entire time - you incrementally fixed the form without restarting.

## Multi-Session: The Ultimate Advantage

The stateful skill goes even further with **multi-session support**:

```bash
# Session 1: Admin user
node dist/cli.js start --session admin
node dist/cli.js eval "await page.goto('https://app.com/login')" --session admin
node dist/cli.js eval "await page.fill('#user', 'admin'); await page.click('#login')" --session admin

# Session 2: Regular user (completely isolated from admin)
node dist/cli.js start --session user
node dist/cli.js eval "await page.goto('https://app.com/login')" --session user
node dist/cli.js eval "await page.fill('#user', 'user'); await page.click('#login')" --session user

# Session 3: Guest (no login)
node dist/cli.js start --session guest
node dist/cli.js eval "await page.goto('https://app.com')" --session guest

# Now test permissions across all three sessions simultaneously
node dist/cli.js eval "await page.goto('/admin-panel')" --session admin  # ✅ Works
node dist/cli.js eval "await page.goto('/admin-panel')" --session user   # ❌ Denied
node dist/cli.js eval "await page.goto('/admin-panel')" --session guest  # ❌ Denied
```

**This is impossible with naive Playwright** - you'd need to write complex code to manage multiple browser instances and coordinate them.

## When to Use Each Approach

### Use Naive Playwright When:
- ✅ Simple one-off automation scripts
- ✅ CI/CD test suites (fresh state desired)
- ✅ Scripts that run independently
- ✅ You need clean slate every time

### Use Playwright Stateful When:
- ✅ Interactive development of automation
- ✅ Complex multi-step workflows
- ✅ Need to maintain login sessions
- ✅ Debugging browser interactions
- ✅ Testing with multiple user roles simultaneously
- ✅ Incremental workflow building
- ✅ Working with AI agents (Claude) that build workflows step-by-step

## Performance Considerations

### Naive Playwright
- 🐌 Browser launch: ~2-3 seconds per execution
- 🐌 Navigation + auth: 5-10 seconds per execution
- ⚡ Lower memory (browser closes after each run)

### Playwright Stateful
- ⚡ First launch: ~2-3 seconds
- ⚡ Subsequent executions: ~100ms (HTTP call only)
- ⚡ Navigation: only when needed (already logged in)
- 🐌 Higher memory (browser stays running)

For iterative development and AI-assisted workflows, the stateful approach is **orders of magnitude faster**.

## Conclusion

**Naive Playwright** is like writing a full program every time - it works, but it's slow and repetitive.

**Playwright Stateful** is like using a REPL or interactive debugger - you can pause, inspect, adjust, and continue. This makes it ideal for:
- AI agents like Claude building workflows incrementally
- Developers debugging complex browser interactions
- Testing scenarios requiring maintained session state
- Situations where multiple user contexts need to be tested in parallel

The statefulness isn't just a convenience feature - it fundamentally changes how you develop and debug browser automation.
