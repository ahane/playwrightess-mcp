# Playwright Stateful - Claude Code Skill

**A Claude Code skill for persistent, stateful browser automation with Playwright**

> **🎯 What is a Claude Code Skill?**
>
> This is a [Claude Code skill](https://docs.anthropic.com/claude/docs/claude-code) that extends Claude's capabilities with persistent browser automation. When Claude uses this skill, it can maintain browser state across multiple operations, enabling complex multi-step workflows.

> **📜 Migrated from MCP**
>
> Originally a Model Context Protocol (MCP) server, now a standalone Claude Code skill with enhanced multi-session support.

## Features

- **🔄 Persistent State**: Browser state maintained between code executions
- **🎭 Multi-Session Support**: Run multiple isolated browser contexts simultaneously
- **🔐 Login Persistence**: Sessions survive between operations
- **🧩 Incremental Workflows**: Build complex automations step-by-step
- **⚡ AST Rewriting**: Variables automatically tracked and persisted
- **🤖 AI-Optimized**: Designed for efficient use by AI agents

## Installation

```bash
npm install
npm run build
```

## Quick Start

### Basic Usage

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

### Multi-Session Usage

Run multiple isolated browser sessions simultaneously:

```bash
# Start multiple sessions
node dist/cli.js start --session admin
node dist/cli.js start --session user1

# Each session maintains independent state
node dist/cli.js eval "await page.goto('http://app.com/admin')" --session admin
node dist/cli.js eval "await page.goto('http://app.com/user')" --session user1

# List active sessions
node dist/cli.js sessions

# Stop specific sessions
node dist/cli.js stop --session admin
node dist/cli.js stop --session user1
```

## Using as a Claude Code Skill

This project **is** a Claude Code skill. The skill documentation is located in the `skill/` directory.

### Using with Claude Code

**Option 1: Project-Specific (Recommended for Development)**

Copy or symlink the skill to this project's `.claude/skills/` directory:

```bash
# From the project root
mkdir -p .claude/skills
ln -s "$(pwd)/skill" .claude/skills/playwright-stateful

# Or copy it
cp -r skill .claude/skills/playwright-stateful
```

**Option 2: Global Installation (Use Anywhere)**

To make this skill available across all projects:

```bash
# Symlink to your global skills directory
ln -s "$(pwd)/skill" ~/.claude/skills/playwright-stateful

# Or copy it (updates won't sync)
cp -r skill ~/.claude/skills/playwright-stateful
```

### How Claude Uses This Skill

When you ask Claude to perform browser automation tasks:

1. Claude recognizes the need for persistent browser state
2. Automatically invokes the playwright-stateful skill
3. Uses the CLI commands to control browser sessions
4. Maintains state across multiple operations
5. Can manage multiple sessions for testing different scenarios

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

- **src/multi-executor.ts** - Multi-session code execution with AST rewriting
- **src/multi-session-manager.ts** - Multiple browser session lifecycle management
- **src/executor.ts** - Single-session code execution (legacy)
- **src/session-manager.ts** - Single browser session management (legacy)
- **src/server.ts** - HTTP server for persistent state
- **src/cli.ts** - Command-line interface with session support

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

**📖 For a detailed explanation of statefulness, see [STATEFULNESS.md](./STATEFULNESS.md)**

This document explains:
- How naive Playwright loses state between executions
- How this skill maintains persistent browser sessions
- Technical implementation using AST rewriting and VM contexts
- Real-world debugging examples showing the difference
- When to use each approach

## Files

### Skill Files (in `skill/` directory)
- `skill/SKILL.md` - Main skill definition with development style guide
- `skill/REFERENCE.md` - Complete API documentation
- `skill/WORKFLOWS.md` - 10 detailed real-world workflows
- `skill/PROJECT-SCRIPTS.md` - Project-specific script guide
- `skill/TROUBLESHOOTING.md` - Problem solving guide
- `skill/REACT-INSPECTION.md` - React debugging techniques
- `skill/DISCOVERY.md` - Automatic project script discovery

### Source Files
- `src/multi-executor.ts` - Multi-session code execution
- `src/multi-session-manager.ts` - Multi-session browser management
- `src/server.ts` - Background HTTP server
- `src/cli.ts` - Command-line interface
- `src/executor.ts` - Single-session executor (legacy)
- `src/session-manager.ts` - Single-session manager (legacy)
- `src/index.ts.mcp-backup` - Original MCP server (archived)

### Runtime Files
- `.playwright-sessions/<sessionId>/` - Per-session browser data directories
- `.playwright-storage-states/<sessionId>-state.json` - Per-session cookies/localStorage
- `.session-server.pid` - Background server PID

## Migration from MCP

### What Changed

**Removed:**
- ❌ `@modelcontextprotocol/sdk` dependency
- ❌ MCP server interface (`src/index.ts`)
- ❌ Single-session limitation

**Added:**
- ✅ Multi-session support (run multiple isolated browsers)
- ✅ HTTP server architecture (`src/server.ts`)
- ✅ CLI interface with session parameters (`src/cli.ts`)
- ✅ Claude Code skill definition (`.claude/skills/`)
- ✅ Session management commands (`sessions`, `--session` parameter)

**Kept & Enhanced:**
- ✅ Code executor with AST rewriting (now multi-session aware)
- ✅ Browser session management (now supports multiple sessions)
- ✅ Persistent state across executions
- ✅ Storage state persistence

### Why Migrate?

- **MCP Deprecated**: Model Context Protocol is no longer supported
- **Better Integration**: Claude Code skills are the official extension mechanism
- **Multi-Session**: Can now test multiple user scenarios simultaneously
- **Simpler**: HTTP server is easier than MCP protocol
- **More Versatile**: CLI can be used standalone or via Claude
- **Same Power**: All original functionality preserved and enhanced

## License

Apache 2.0

## Credits

Original MCP implementation concept with AST-based variable tracking and persistent browser sessions.
Migrated to Claude Code skill architecture November 2024.
