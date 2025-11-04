# Development Style Guide

Comprehensive best practices for developing with playwright-stateful skill.

## Handling Transient UI Elements

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

## Verification Patterns

### Pattern 1: Capture transient feedback immediately

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

### Pattern 2: Log element existence before interaction

```bash
node dist/cli.js eval "
  // Log what's visible before clicking
  const buttonText = await page.textContent('button#submit');
  const isEnabled = await page.isEnabled('button#submit');
  console.log('Button state:', { text: buttonText, enabled: isEnabled });

  await page.click('button#submit');
"
```

### Pattern 3: Capture all notifications in sequence

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

## Debugging Workflow

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

## Common Mistakes to Avoid

### ❌ Relying on screenshots for transient elements

```bash
# Toast appears and disappears in 3 seconds
node dist/cli.js eval "await page.click('#save')"
node dist/cli.js eval "await page.screenshot({path: 'result.png'})"  # Toast already gone!
```

### ✅ Log transient, screenshot persistent

```bash
node dist/cli.js eval "
  await page.click('#save');
  const toast = await page.locator('.toast').textContent();
  console.log('Save result:', toast);
"
node dist/cli.js eval "await page.screenshot({path: 'result.png'})"  # Shows final state
```

### ❌ Not verifying element existence

```bash
node dist/cli.js eval "await page.click('.submit-button')"  # Might not exist
```

### ✅ Check existence and log state

```bash
node dist/cli.js eval "
  const button = await page.$('.submit-button');
  console.log('Submit button exists:', !!button);
  if (button) {
    await button.click();
  }
"
```

## Multi-Session Development Style

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

## Performance Tips

1. **Avoid unnecessary waits** - Only wait for specific conditions
2. **Batch related operations** - Reduce HTTP round-trips to server
3. **Use short timeouts** - Default 8s is already optimized
4. **Clean up sessions** - Stop sessions when done to free resources

### ❌ Slow: Multiple round-trips

```bash
node dist/cli.js eval "await page.click('#btn1')"
node dist/cli.js eval "await page.click('#btn2')"
node dist/cli.js eval "await page.click('#btn3')"
```

### ✅ Fast: Single round-trip

```bash
node dist/cli.js eval "
  await page.click('#btn1');
  await page.click('#btn2');
  await page.click('#btn3');
"
```

## Logging Best Practices

### Structured Logging

Use consistent log formats for easier parsing:

```bash
node dist/cli.js eval "
  console.log(JSON.stringify({
    action: 'navigation',
    url: page.url(),
    title: await page.title()
  }));
"
```

### Error Context

Log full context when errors occur:

```bash
node dist/cli.js eval "
  try {
    await page.click('#missing-element');
  } catch (error) {
    console.log('Error context:', {
      error: error.message,
      url: page.url(),
      selector: '#missing-element',
      pageContent: await page.content()
    });
    throw error;
  }
"
```

### State Snapshots

Capture state snapshots at key points:

```bash
node dist/cli.js eval "
  // Before action
  const beforeState = {
    url: page.url(),
    cookies: await context.cookies(),
    localStorage: await page.evaluate(() => JSON.stringify(localStorage))
  };
  console.log('Before:', beforeState);

  await page.click('#logout');

  // After action
  const afterState = {
    url: page.url(),
    cookies: await context.cookies()
  };
  console.log('After:', afterState);
"
```
