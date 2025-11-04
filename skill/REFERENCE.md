# API Reference

Complete API documentation for playwright-stateful.

## Multi-Session Architecture

The system supports multiple isolated browser sessions running simultaneously. Each session has:
- Separate user data directory: `.playwright-sessions/<sessionId>/`
- Separate storage state: `.playwright-storage-states/<sessionId>-state.json`
- Isolated browser context, pages, and cookies
- Independent VM execution context

Use the `--session <name>` CLI parameter to specify which session to operate on. Sessions default to `"default"` if not specified.

## Session Manager API

The `sessionManager` provides methods for managing persistent browser sessions:

### ensureBrowser(sessionId)

```javascript
const browser = await sessionManager.ensureBrowser(sessionId)
```

Returns the persistent browser instance for the given session. Launches browser if not already running.

**Parameters:**
- `sessionId` (string) - Session identifier

**Returns:** `Promise<Browser>`

### ensureContext(sessionId)

```javascript
const context = await sessionManager.ensureContext(sessionId)
```

Returns the persistent browser context for the given session with saved storage state.

**Parameters:**
- `sessionId` (string) - Session identifier

**Returns:** `Promise<BrowserContext>`

### ensurePage(sessionId)

```javascript
const page = await sessionManager.ensurePage(sessionId)
```

Returns a page from the persistent context for the given session. Creates new page if none exists.

**Parameters:**
- `sessionId` (string) - Session identifier

**Returns:** `Promise<Page>`

### saveStorageState(sessionId)

```javascript
await sessionManager.saveStorageState(sessionId)
```

Saves cookies and localStorage to `.playwright-storage-states/<sessionId>-state.json`.

**Parameters:**
- `sessionId` (string) - Session identifier

**Returns:** `Promise<void>`

### cleanupSession(sessionId)

```javascript
await sessionManager.cleanupSession(sessionId)
```

Closes browser and cleans up resources for a specific session.

**Parameters:**
- `sessionId` (string) - Session identifier

**Returns:** `Promise<void>`

### cleanupAll()

```javascript
await sessionManager.cleanupAll()
```

Closes all browser sessions and cleans up all resources.

**Returns:** `Promise<void>`

### listSessions()

```javascript
const sessions = sessionManager.listSessions()
```

Returns array of active session IDs.

**Returns:** `string[]`

### hasSession(sessionId)

```javascript
const exists = sessionManager.hasSession(sessionId)
```

Checks if a session exists.

**Parameters:**
- `sessionId` (string) - Session identifier

**Returns:** `boolean`

## Available APIs in Execution Context

The VM execution context includes the following APIs:

### Playwright Modules

- `chromium` - Chromium browser launcher
- `firefox` - Firefox browser launcher
- `webkit` - WebKit browser launcher
- `devices` - Device descriptors for emulation

**Example:**
```javascript
const iPhone = devices['iPhone 13'];
await page.emulate(iPhone);
```

### Node.js Built-ins

- `console` - Logging (captured and returned)
- `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` - Timers
- `Buffer` - Binary data handling
- `URL`, `URLSearchParams` - URL manipulation
- `process` - Process information
- `require` - Module loading

### Session Management

- `sessionManager` - Multi-session browser manager (see above)
- `sessionId` - Current session identifier (string)
- `sharedState` - Persistent object for custom data storage (per-session)

**Example:**
```javascript
// Access current session ID
console.log('Current session:', sessionId);

// Store data in shared state (persists across executions within this session)
sharedState.myData = { count: 0 };
sharedState.myData.count++;

// Interact with session manager
const allSessions = sessionManager.listSessions();
console.log('All active sessions:', allSessions);
```

## Tracked Variables

These variables automatically persist between executions:

- `page` - Current Playwright page
- `browser` - Browser instance
- `context` - Browser context
- `sessionManager` - Session manager instance

**Note:** Other variables are NOT tracked and will be lost between executions.

## Configuration Options

### Browser Settings

Default configuration (configured in session manager):

| Setting | Default | Description |
|---------|---------|-------------|
| Browser | Chromium | Browser type to launch |
| Headless | false | Browser visibility |
| Viewport | 1280x720 | Default viewport size |
| User data dir | `.playwright-session/` | Persistent browser data |
| Storage state | `shared-storage-state.json` | Saved cookies/localStorage |
| Timeout | 8000ms | Default operation timeout |

### Customizing Configuration

**Change timeout:**
```javascript
page.setDefaultTimeout(15000);  // 15 seconds
```

**Launch different browser:**
```javascript
const browser = await firefox.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
```

**Change viewport:**
```javascript
await page.setViewportSize({ width: 1920, height: 1080 });
```

**Enable device emulation:**
```javascript
const iPhone = devices['iPhone 13'];
await context.close();
const context = await browser.newContext({ ...iPhone });
const page = await context.newPage();
```

## Response Format

All evaluations return a JSON response:

**Success:**
```json
{
  "success": true,
  "result": <any>,
  "browserConsoleLogs": ["array", "of", "messages"],
  "sessionConsoleLogs": ["array", "of", "messages"]
}
```

**Error:**
```json
{
  "success": false,
  "error": "error message",
  "stack": "stack trace",
  "browserConsoleLogs": [],
  "sessionConsoleLogs": []
}
```

## CLI Commands

All commands support the `--session <name>` parameter to specify which session to operate on. Sessions default to `"default"` if not specified.

### start

Start a persistent browser session.

```bash
# Start default session
node dist/cli.js start

# Start named session
node dist/cli.js start --session user1
```

**Returns:**
```json
{"success": true, "sessionId": "user1", "message": "Session 'user1' started"}
```

### eval

Execute JavaScript code in the persistent session.

```bash
# Execute in default session
node dist/cli.js eval "<code>"

# Execute in named session
node dist/cli.js eval "<code>" --session user1
```

**Example:**
```bash
node dist/cli.js eval "await page.goto('http://example.com')"
node dist/cli.js eval "await page.goto('http://example.com')" --session admin
```

**Returns:**
```json
{
  "success": true,
  "result": null,
  "browserConsoleLogs": [],
  "sessionConsoleLogs": [],
  "sessionId": "admin"
}
```

### stop

Stop a session and save state.

```bash
# Stop default session
node dist/cli.js stop

# Stop specific session
node dist/cli.js stop --session user1
```

**Returns:**
```json
{"success": true, "sessionId": "user1", "message": "Session 'user1' stopped"}
```

### sessions

List all active sessions.

```bash
node dist/cli.js sessions
```

**Returns:**
```json
{"success": true, "sessions": ["default", "user1", "admin"], "count": 3}
```

### shutdown

Shutdown the background server and all sessions.

```bash
node dist/cli.js shutdown
```

**Returns:**
```json
{"success": true, "message": "Server shut down"}
```

### status

Check if server is running.

```bash
node dist/cli.js status
```

**Returns:**
```json
{"serverRunning": true}
```

## File Locations

- **CLI Tool:** `dist/cli.js`
- **Background Server:** `dist/server.js` (auto-started)
- **Session Data:** `.playwright-session/` (browser user data)
- **Storage State:** `shared-storage-state.json` (cookies/localStorage)
- **Server PID:** `.session-server.pid` (background process ID)

## Error Codes

Common errors and their meanings:

| Error | Meaning | Solution |
|-------|---------|----------|
| "Session not started" | Server not running | Run `node dist/cli.js start` |
| "Server not running" | Background server stopped | Run `start` command again |
| "Failed to start server" | Port 45123 in use | Kill existing server or change port |
| "net::ERR_NAME_NOT_RESOLVED" | Invalid URL | Check URL format |
| "Timeout exceeded" | Operation took >8s | Increase timeout or simplify operation |

## Advanced Features

### Custom Context Options

Create custom browser contexts:

```javascript
const context = await browser.newContext({
  userAgent: 'Custom User Agent',
  viewport: { width: 1920, height: 1080 },
  geolocation: { latitude: 37.7749, longitude: -122.4194 },
  permissions: ['geolocation'],
  locale: 'en-US',
  timezoneId: 'America/Los_Angeles'
});
```

### Network Interception

Intercept and modify network requests:

```javascript
await page.route('**/api/**', route => {
  const url = route.request().url();
  console.log('API request:', url);
  route.continue();
});

await page.route('**/images/**', route => {
  route.abort();  // Block image loading
});
```

### Request Modification

```javascript
await page.route('**/api/data', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ mocked: true })
  });
});
```

### Video Recording

```javascript
const context = await browser.newContext({
  recordVideo: {
    dir: '/tmp/videos/',
    size: { width: 1280, height: 720 }
  }
});
```

### PDF Generation

```javascript
await page.goto('https://example.com');
await page.pdf({
  path: '/tmp/page.pdf',
  format: 'A4',
  printBackground: true
});
```

## Limitations

- **Single session:** Only one session can run at a time (singleton pattern)
- **Variable tracking:** Only specific variables persist (`page`, `browser`, `context`, `sessionManager`)
- **Memory:** Large `sharedState` objects consume memory
- **Resources:** Browser stays open consuming resources until stopped
- **Sandbox:** Code executes in VM sandbox with limited Node.js APIs
- **Port:** Uses port 45123 (must be available)
