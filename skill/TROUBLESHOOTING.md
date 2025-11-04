# Troubleshooting Guide

Common issues and solutions for playwright-stateful.

## Server Issues

### Server Won't Start

**Symptoms:**
```bash
node dist/cli.js start
# Returns: "Failed to start server"
```

**Causes:**
- Port 45123 already in use
- Previous server still running
- Permission issues

**Solutions:**

**1. Check if server is already running:**
```bash
node dist/cli.js status
```

**2. Kill existing server:**
```bash
node dist/cli.js shutdown
# Or force kill
pkill -f "node.*dist/server.js"
```

**3. Check if port is in use:**
```bash
lsof -i :45123
# Kill the process using the port
kill -9 <PID>
```

**4. Clear PID file:**
```bash
rm .session-server.pid
```

### Server Crashes or Disconnects

**Symptoms:**
- Server stops responding
- Commands hang indefinitely
- "ECONNREFUSED" errors

**Solutions:**

**1. Check server logs:**
```bash
# Server runs in background, check for errors
ps aux | grep server.js
```

**2. Restart server:**
```bash
node dist/cli.js shutdown
rm .session-server.pid
node dist/cli.js start
```

**3. Check for resource exhaustion:**
```bash
# Check memory usage
ps aux | grep chromium
# Kill if using too much memory
pkill -f chromium
```

## Browser Issues

### Browser Processes Won't Die

**Symptoms:**
- Multiple Chromium processes remain after stopping
- High CPU/memory usage
- System slowdown

**Solutions:**

**1. Kill all Chromium processes:**
```bash
pkill -f chromium
# Or more forcefully
pkill -9 -f chromium
```

**2. Find and kill specific processes:**
```bash
ps aux | grep chromium
kill -9 <PID>
```

**3. Clean up session data:**
```bash
rm -rf .playwright-session/
```

### Browser Won't Launch

**Symptoms:**
```json
{
  "success": false,
  "error": "Failed to launch browser"
}
```

**Causes:**
- Playwright browsers not installed
- Missing dependencies
- Permission issues

**Solutions:**

**1. Install Playwright browsers:**
```bash
npx playwright install chromium
```

**2. Install system dependencies:**
```bash
# On Linux
npx playwright install-deps chromium

# On macOS (via Homebrew)
brew install --cask chromium
```

**3. Check permissions:**
```bash
ls -la ~/.cache/ms-playwright/
# Should be readable/writable
```

**4. Clear browser cache:**
```bash
rm -rf ~/.cache/ms-playwright/
npx playwright install chromium
```

### Browser Opens But Page is Blank

**Symptoms:**
- Browser window opens
- Page stays white/blank
- No errors in console

**Solutions:**

**1. Check if page is actually loading:**
```bash
node dist/cli.js eval "console.log(await page.title())"
```

**2. Increase timeout:**
```bash
node dist/cli.js eval "page.setDefaultTimeout(15000)"
```

**3. Check network connectivity:**
```bash
node dist/cli.js eval "await page.goto('http://example.com', {waitUntil: 'domcontentloaded'})"
```

**4. Take screenshot to debug:**
```bash
node dist/cli.js eval "await page.screenshot({path: '/tmp/debug.png'})"
```

## State Issues

### State Not Persisting

**Symptoms:**
- Variables disappear between executions
- `page` or `browser` is undefined
- Login sessions don't persist

**Causes:**
- Variable not tracked
- Server restarted
- Storage state not saved

**Solutions:**

**1. Check which variables persist:**
Only these persist automatically:
- `page`, `browser`, `context`, `sessionManager`, `sharedState`

**2. Use sharedState for custom data:**
```bash
node dist/cli.js eval "sharedState.myData = 'test'"
node dist/cli.js eval "console.log(sharedState.myData)"  # Should work
```

**3. Verify state is being tracked:**
```bash
node dist/cli.js eval "const page = await browser.newPage()"  # Auto-tracked
node dist/cli.js eval "const myVar = 'test'"  # NOT tracked (use sharedState)
```

**4. Save storage state manually:**
```bash
node dist/cli.js eval "await sessionManager.saveStorageState()"
```

### Cookies/localStorage Not Persisting

**Symptoms:**
- Have to login every time
- Cookies disappear
- localStorage is empty

**Causes:**
- Storage state not saved properly
- Context cleared
- Session expired

**Solutions:**

**1. Check storage state file:**
```bash
ls -la shared-storage-state.json
cat shared-storage-state.json  # Should contain cookies
```

**2. Save storage state before stopping:**
```bash
node dist/cli.js eval "await sessionManager.saveStorageState()"
node dist/cli.js stop
```

**3. Verify cookies exist:**
```bash
node dist/cli.js eval "const cookies = await page.context().cookies(); console.log(cookies)"
```

**4. Clear and regenerate:**
```bash
rm shared-storage-state.json
# Login again and cookies will be saved on stop
```

## Execution Issues

### Code Execution Fails

**Symptoms:**
```json
{
  "success": false,
  "error": "ReferenceError: page is not defined"
}
```

**Causes:**
- Session not started
- Browser not initialized
- Syntax error in code

**Solutions:**

**1. Ensure session is started:**
```bash
node dist/cli.js status
# Should return {"serverRunning": true}
```

**2. Check if browser is initialized:**
```bash
node dist/cli.js eval "console.log(typeof page)"
# Should print "object"
```

**3. Check code syntax:**
```bash
# Test with simple code first
node dist/cli.js eval "console.log('test')"
```

**4. Check error details:**
```bash
node dist/cli.js eval "your code here"
# Read the error message and stack trace
```

### Timeout Errors

**Symptoms:**
```json
{
  "success": false,
  "error": "Timeout 8000ms exceeded"
}
```

**Causes:**
- Slow page load
- Waiting for element that doesn't exist
- Network issues

**Solutions:**

**1. Increase timeout:**
```bash
node dist/cli.js eval "page.setDefaultTimeout(15000)"
```

**2. Don't wait for networkidle:**
```bash
# Bad (slow):
node dist/cli.js eval "await page.goto('url', {waitUntil: 'networkidle'})"

# Good (fast):
node dist/cli.js eval "await page.goto('url', {waitUntil: 'domcontentloaded'})"
```

**3. Remove waitForSelector:**
```bash
# Don't use waitForSelector - directly interact instead
node dist/cli.js eval "await page.click('button')"
```

### Memory Leaks

**Symptoms:**
- Memory usage grows over time
- System becomes slow
- Browser crashes

**Causes:**
- Large sharedState objects
- Many pages open
- Resource leak

**Solutions:**

**1. Clear sharedState periodically:**
```bash
node dist/cli.js eval "sharedState = {}"
```

**2. Close unused pages:**
```bash
node dist/cli.js eval "
  const pages = await browser.pages();
  for (const p of pages.slice(1)) {
    await p.close();
  }
"
```

**3. Restart session:**
```bash
node dist/cli.js stop
node dist/cli.js start
```

## File/Permission Issues

### Permission Denied Errors

**Symptoms:**
```
Error: EACCES: permission denied
```

**Solutions:**

**1. Check directory permissions:**
```bash
ls -la .playwright-session/
ls -la shared-storage-state.json
```

**2. Fix permissions:**
```bash
chmod -R 755 .playwright-session/
chmod 644 shared-storage-state.json
```

**3. Check ownership:**
```bash
# Should be owned by current user
ls -la .playwright-session/
```

### Cannot Find Module Errors

**Symptoms:**
```
Error: Cannot find module 'playwright'
```

**Solutions:**

**1. Reinstall dependencies:**
```bash
npm install
```

**2. Rebuild:**
```bash
npm run build
```

**3. Check node_modules:**
```bash
ls -la node_modules/playwright/
```

## Network Issues

### Cannot Connect to Localhost

**Symptoms:**
```
Error: net::ERR_CONNECTION_REFUSED at http://localhost:3000
```

**Solutions:**

**1. Check if dev server is running:**
```bash
curl http://localhost:3000
# Or
lsof -i :3000
```

**2. Use correct port:**
```bash
# Check your dev server's actual port
node dist/cli.js eval "await page.goto('http://localhost:8080')"
```

**3. Use external URL if needed:**
```bash
node dist/cli.js eval "await page.goto('https://example.com')"
```

### CORS Errors

**Symptoms:**
- CORS errors in browser console
- Requests fail

**Solutions:**

**1. Check browser console:**
```bash
node dist/cli.js eval "
  await page.goto('http://localhost:3000');
  const logs = await page.evaluate(() => console.log('check console'));
"
# Check browserConsoleLogs in response
```

**2. Disable web security (dev only):**
```bash
node dist/cli.js eval "
  await browser.close();
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-web-security']
  });
"
```

## Project Scripts Issues

### Scripts Not Found

**Symptoms:**
```
cat: .claude/browser/sessions/authenticated.js: No such file or directory
```

**Solutions:**

**1. Check directory exists:**
```bash
ls -la .claude/browser/
```

**2. Create directory structure:**
```bash
mkdir -p .claude/browser/sessions
mkdir -p .claude/browser/scripts
```

**3. Copy templates:**
```bash
cp -r examples/claude-browser/* .claude/browser/
```

### Script Execution Fails

**Symptoms:**
- Script runs but errors occur
- Login fails
- Selectors not found

**Solutions:**

**1. Test script manually:**
```bash
cat .claude/browser/sessions/authenticated.js
# Verify selectors are correct
```

**2. Run script step by step:**
```bash
# Run each line individually to find which fails
node dist/cli.js eval "await page.goto('http://localhost:3000/login')"
node dist/cli.js eval "await page.fill('#email', 'test@example.com')"
# ... etc
```

**3. Take screenshots:**
```bash
node dist/cli.js eval "await page.screenshot({path: '/tmp/script-debug.png'})"
```

**4. Update selectors:**
```bash
# Inspect page to find correct selectors
node dist/cli.js eval "console.log(await page.content())"
```

## React Inspection Issues

### Cannot Access React Internals

**Symptoms:**
- `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` is undefined
- Fiber keys not found

**Solutions:**

**1. Check if React app:**
```bash
node dist/cli.js eval "
  const hasReact = await page.evaluate(() =>
    typeof window.React !== 'undefined'
  );
  console.log('Has React:', hasReact);
"
```

**2. Use development build:**
- React internals are minified in production
- Use dev build for inspection

**3. Check fiber key:**
```bash
node dist/cli.js eval "
  const keys = await page.evaluate(() => {
    const el = document.querySelector('#root');
    return Object.keys(el);
  });
  console.log(keys);
"
```

## Getting Help

If you're stuck:

1. **Check logs:**
   ```bash
   # Check what's actually being executed
   node dist/cli.js eval "console.log('test')"
   ```

2. **Take screenshots:**
   ```bash
   node dist/cli.js eval "await page.screenshot({path: '/tmp/debug.png'})"
   ```

3. **Inspect HTML:**
   ```bash
   node dist/cli.js eval "console.log(await page.content())"
   ```

4. **Restart everything:**
   ```bash
   node dist/cli.js shutdown
   pkill -f chromium
   rm -rf .playwright-session/ shared-storage-state.json .session-server.pid
   npm run build
   node dist/cli.js start
   ```

5. **Check versions:**
   ```bash
   node --version
   npm --version
   npm list playwright
   ```
