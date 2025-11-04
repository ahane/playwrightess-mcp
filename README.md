# Playwright Stateful - Claude Code Skill

> **Migrated from MCP to Claude Code Skill**
>
> This project was originally a Model Context Protocol (MCP) server. It has been migrated to a Claude Code skill that provides persistent Playwright browser automation with state maintained across code executions.

## What Is This?

A persistent Playwright browser automation environment where:
- Browser state is maintained between code executions
- Variables like `page`, `browser`, `context` persist automatically
- Multi-step workflows can be built incrementally
- Login sessions survive between operations
- Code snippets are executed via AST rewriting for automatic state tracking

## Installation

```bash
npm install
npm run build
```

## Quick Start

```bash
# Start a persistent session (launches browser in background)
node dist/cli.js start

# Execute code snippets (state persists between calls)
node dist/cli.js eval "await page.goto('http://example.com')"
node dist/cli.js eval "console.log(await page.title())"
node dist/cli.js eval "await page.screenshot({path: '/tmp/shot.png'})"

# Stop the session (saves state)
node dist/cli.js stop

# Shutdown the background server
node dist/cli.js shutdown
```

## Using as a Claude Code Skill

The skill definition is located at `.claude/skills/playwright-stateful/SKILL.md`.

### For Project-Specific Use

The skill is already in this project's `.claude/skills/` directory and will be available when Claude Code runs in this project.

### For Global Use

To use this skill across all projects:

```bash
# Copy the skill to global skills directory
cp -r .claude/skills/playwright-stateful ~/.claude/skills/
```

### Project-Specific Browser Scripts

Store reusable browser automation scripts in `.claude/browser/`:

```
.claude/browser/
├── sessions/          # Pre-configured login sessions
│   └── authenticated.js
├── scripts/           # Utility scripts
│   ├── setup-test-data.js
│   └── screenshot-flow.js
└── README.md          # Documentation
```

**When Claude starts a session, it will automatically:**
1. Check for `.claude/browser/` directory
2. Read available sessions and scripts
3. Ask which session to use
4. Execute the session setup

See `examples/claude-browser/` for templates you can copy and customize for your project.

## Usage Examples

### Multi-Step Login Flow

```bash
node dist/cli.js start
node dist/cli.js eval "await page.goto('https://example.com/login')"
node dist/cli.js eval "await page.fill('#email', 'user@example.com')"
node dist/cli.js eval "await page.fill('#password', 'password123')"
node dist/cli.js eval "await page.click('button[type=submit]')"
node dist/cli.js eval "await page.waitForURL('**/dashboard')"
node dist/cli.js eval "await page.screenshot({path: '/tmp/dashboard.png'})"
node dist/cli.js stop
```

### Using Shared State

```bash
node dist/cli.js start
node dist/cli.js eval "sharedState.products = []"
node dist/cli.js eval "await page.goto('https://shop.example.com')"
node dist/cli.js eval "
  const items = await page.$$eval('.product', els =>
    els.map(el => el.textContent)
  );
  sharedState.products.push(...items);
  console.log('Products:', sharedState.products.length);
"
node dist/cli.js stop
```

## Architecture

### Components

- **src/executor.ts** - Code execution engine with AST rewriting
- **src/session-manager.ts** - Browser session lifecycle management
- **src/server.ts** - HTTP server for persistent state
- **src/cli.ts** - Command-line interface

### How It Works

1. **CLI Start**: Launches background HTTP server (port 45123)
2. **Server Start**: Initializes VM context and code executor
3. **CLI Eval**: Sends code to server via HTTP POST
4. **Executor**: Rewrites code using Babel AST to track variables
5. **VM Execution**: Runs code in persistent VM context
6. **State Persistence**: Variables automatically saved to `globalThis`
7. **CLI Stop**: Closes browser, saves state
8. **CLI Shutdown**: Terminates background server

### AST Rewriting Example

```javascript
// You write:
const page = await browser.newPage();

// Gets automatically rewritten to:
const page = await browser.newPage();
globalThis.page = page;  // Auto-injected!
```

This ensures variables persist between separate CLI invocations.

## Token Efficiency

Optimized for AI agent use:
- No `waitForLoadState('networkidle')` (wastes time)
- No `waitForSelector()` (same reason)
- 8-second timeouts (vs standard 30s)
- Minimal console output
- Efficient code execution

## Comparison with Standard Playwright

| Feature | Playwright Stateful | Standard Playwright |
|---------|-------------------|-------------------|
| State persistence | ✅ Across executions | ❌ Script-scoped only |
| Login sessions | ✅ Maintained | ❌ Lost between runs |
| Multi-step flows | ✅ Incremental | ❌ Need full scripts |
| Resource usage | ⚠️ Higher (persistent) | ✅ Lower (ephemeral) |
| Use case | Complex workflows | One-off automation |

## Files

- `.claude/skills/playwright-stateful/SKILL.md` - Skill definition
- `src/executor.ts` - Code execution with AST rewriting
- `src/session-manager.ts` - Browser lifecycle management
- `src/server.ts` - Background HTTP server
- `src/cli.ts` - Command-line interface
- `src/index.ts.mcp-backup` - Original MCP server (archived)
- `.playwright-session/` - Browser user data directory
- `shared-storage-state.json` - Saved cookies/localStorage
- `.session-server.pid` - Background server PID

## Migration from MCP

### What Changed

- ❌ Removed: `@modelcontextprotocol/sdk` dependency
- ❌ Removed: MCP server interface (`src/index.ts`)
- ✅ Added: HTTP server for state persistence (`src/server.ts`)
- ✅ Added: CLI interface (`src/cli.ts`)
- ✅ Added: Claude Code skill definition (`.claude/skills/`)
- ✅ Kept: Code executor with AST rewriting
- ✅ Kept: Session manager with persistent browser

### Why Migrate?

- MCP is deprecated
- Claude Code skills provide better integration
- HTTP server is simpler than MCP protocol
- CLI interface is more versatile
- Same core functionality with better UX

## License

Apache 2.0

## Credits

Original MCP implementation concept with AST-based variable tracking and persistent browser sessions.
Migrated to Claude Code skill architecture November 2024.
