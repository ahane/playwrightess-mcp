# Discovery Workflow for Project Scripts

This document defines the automatic discovery process that should be performed when starting a playwright-stateful session.

## CRITICAL: Always Discover First

**Before starting any browser automation task, ALWAYS check for project-specific scripts.**

This enables:
- Reusing pre-configured login sessions
- Running project-specific setup scripts
- Accessing documented workflows
- Consistent test data creation

## Discovery Steps

### Step 1: Check Directory Exists

```bash
ls -la .claude/browser/
```

**If directory doesn't exist:**
- Proceed with manual session setup
- Optionally suggest creating `.claude/browser/` for future use

**If directory exists:**
- Continue to Step 2

### Step 2: Read Project Documentation

```bash
cat .claude/browser/README.md
```

**This file should contain:**
- List of available sessions
- List of available scripts
- Environment configuration (URLs, ports)
- Common workflows
- Test credentials

**Actions:**
- Parse available sessions and scripts
- Note any special requirements
- Understand the project context

### Step 3: List Available Sessions

```bash
ls -1 .claude/browser/sessions/
```

**Expected output:**
```
admin-login.js
authenticated.js
test-user.js
```

**Actions:**
- Count available sessions
- Note session names for user selection

### Step 4: List Available Scripts

```bash
ls -1 .claude/browser/scripts/
```

**Expected output:**
```
clear-cache.js
screenshot-flow.js
setup-test-data.js
```

**Actions:**
- Count available scripts
- Note script names for later use

### Step 5: Present Options to User

**If multiple sessions available:**

Ask user:
```
Found the following browser sessions for this project:
1. authenticated.js - Login as test@example.com
2. admin-login.js - Login as admin user
3. test-user.js - Login as test user with data

Which session would you like to use? (1-3, or 'none' for manual setup)
```

**If single session available:**

Inform user:
```
Found browser session: authenticated.js
Using this session to start automation.
```

Auto-select and continue.

**If no sessions available but scripts exist:**

```
No pre-configured sessions found, but the following scripts are available:
- setup-test-data.js
- screenshot-flow.js

I'll start a fresh session. Would you like to run any setup scripts first?
```

### Step 6: Execute Session Setup

**Start the session:**

```bash
node dist/cli.js start
```

**Load the selected session:**

```bash
node dist/cli.js eval "$(cat .claude/browser/sessions/authenticated.js)"
```

**Verify success:**
- Check for success console output
- Verify `sharedState` was populated
- Confirm we're in the expected state

### Step 7: Proceed with Task

Now that the session is configured, proceed with the user's requested task.

---

## Complete Discovery Example

```bash
# Discovery Phase
$ ls -la .claude/browser/
drwxr-xr-x  5 user  staff   160 Nov  4 10:00 .
drwxr-xr-x  3 user  staff    96 Nov  4 09:00 ..
-rw-r--r--  1 user  staff  2048 Nov  4 10:00 README.md
drwxr-xr-x  3 user  staff    96 Nov  4 10:00 scripts
drwxr-xr-x  3 user  staff    96 Nov  4 10:00 sessions

$ cat .claude/browser/README.md
# Browser Automation Scripts
## Available Sessions
### sessions/authenticated.js
Logs in as test@example.com...

$ ls -1 .claude/browser/sessions/
authenticated.js

$ ls -1 .claude/browser/scripts/
screenshot-flow.js
setup-test-data.js

# Found single session - auto-select
# Starting session with authenticated.js...

$ node dist/cli.js start
{"success":true,"message":"Session started"}

$ node dist/cli.js eval "$(cat .claude/browser/sessions/authenticated.js)"
{
  "success": true,
  "browserConsoleLogs": [],
  "sessionConsoleLogs": [
    "[LOG] ✓ Logged in as: test@example.com"
  ]
}

# Session ready - proceed with task
```

---

## Discovery Decision Tree

```
Start Task
    ↓
Does .claude/browser/ exist?
    ├─ No → Use manual session setup
    │         ↓
    │      Suggest creating .claude/browser/ for future
    │         ↓
    │      Continue with task
    │
    └─ Yes → Read README.md
               ↓
           List sessions/ and scripts/
               ↓
           Multiple sessions?
               ├─ Yes → Ask user which to use
               │         ↓
               │      Load selected session
               │         ↓
               │      Continue with task
               │
               └─ No → Single session?
                          ├─ Yes → Auto-select and load
                          │         ↓
                          │      Continue with task
                          │
                          └─ No → No sessions found
                                    ↓
                                Scripts available?
                                    ├─ Yes → Ask if user wants to run setup
                                    │         ↓
                                    │      Continue with task
                                    │
                                    └─ No → Use manual session
                                              ↓
                                           Continue with task
```

---

## Output to User

When performing discovery, communicate clearly:

**Good example:**
```
Checking for project-specific browser scripts...
✓ Found .claude/browser/ directory
✓ Reading project documentation...
✓ Found 2 sessions: authenticated.js, admin-login.js
✓ Found 3 scripts: setup-test-data.js, clear-cache.js, screenshot-flow.js

Which session would you like to use?
1. authenticated.js - Test user (test@example.com)
2. admin-login.js - Admin user (admin@example.com)
```

**Bad example:**
```
Starting session...
[No discovery performed]
```

---

## Error Handling

### README.md is Malformed

```bash
cat .claude/browser/README.md
# Returns garbage or error

# Action: Skip README, continue with listing files
# Inform user: "Found .claude/browser/ but README is unreadable"
```

### Session Script Fails to Execute

```bash
node dist/cli.js eval "$(cat .claude/browser/sessions/broken.js)"
# Returns error

# Action: Inform user, ask if they want to try another session or manual setup
# User message: "Session script failed: <error>. Would you like to try manual setup?"
```

### No Permissions to Read Directory

```bash
ls .claude/browser/
# Permission denied

# Action: Fall back to manual setup
# Inform user: "Cannot access .claude/browser/ (permission denied)"
```

---

## Best Practices for Discovery

1. **Always discover first** - Never skip discovery if `.claude/browser/` exists
2. **Communicate clearly** - Tell user what was found
3. **Handle gracefully** - If discovery fails, fall back to manual
4. **Respect user choice** - Let user override auto-selection
5. **Cache results** - Save discovered info to `sharedState` for reference
6. **Update as needed** - Re-discover if user requests different session

---

## Saving Discovery Results

Store discovered information in `sharedState`:

```bash
node dist/cli.js eval "
  sharedState.projectScripts = {
    hasDirectory: true,
    sessions: ['authenticated.js', 'admin-login.js'],
    scripts: ['setup-test-data.js', 'screenshot-flow.js'],
    selectedSession: 'authenticated.js',
    documentationRead: true
  };
"
```

This allows:
- Referencing what's available later
- Switching sessions mid-task
- Running scripts without re-discovery

---

## Quick Reference Commands

**Check for directory:**
```bash
[ -d ".claude/browser" ] && echo "exists" || echo "not found"
```

**Read README (if exists):**
```bash
[ -f ".claude/browser/README.md" ] && cat .claude/browser/README.md || echo "No README"
```

**List sessions:**
```bash
[ -d ".claude/browser/sessions" ] && ls -1 .claude/browser/sessions/ || echo "No sessions"
```

**List scripts:**
```bash
[ -d ".claude/browser/scripts" ] && ls -1 .claude/browser/scripts/ || echo "No scripts"
```

**Execute session:**
```bash
node dist/cli.js eval "$(cat .claude/browser/sessions/SESSIONNAME.js)"
```

**Execute script:**
```bash
node dist/cli.js eval "$(cat .claude/browser/scripts/SCRIPTNAME.js)"
```
