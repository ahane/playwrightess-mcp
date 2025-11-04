# React App Inspection

This document covers techniques for inspecting React applications using the stateful browser session.

## Table of Contents

1. [Direct React Internals Access](#direct-react-internals-access)
2. [Using React DevTools Extension](#using-react-devtools-extension)
3. [Component State Inspection](#component-state-inspection)
4. [Props and Context Inspection](#props-and-context-inspection)
5. [Hooks Inspection](#hooks-inspection)
6. [Component Tree Navigation](#component-tree-navigation)
7. [Performance Profiling](#performance-profiling)

---

## Direct React Internals Access

You can access React's internal fiber tree directly without any extensions.

### Finding React Root

```bash
node dist/cli.js start
node dist/cli.js eval "await page.goto('http://localhost:3000')"

# Find React root (React 18+)
node dist/cli.js eval "
  const reactRoot = await page.evaluate(() => {
    const root = document.querySelector('#root');
    // React 18 stores fiber in _reactRootContainer or __reactContainer
    const internalKey = Object.keys(root).find(key =>
      key.startsWith('__reactContainer') || key.startsWith('_reactRootContainer')
    );
    return !!internalKey;
  });
  console.log('React root found:', reactRoot);
"
```

### Accessing Fiber Tree

```bash
# Get component fiber
node dist/cli.js eval "
  const componentInfo = await page.evaluate(() => {
    // Find a DOM element rendered by React
    const element = document.querySelector('[data-testid=\"my-component\"]');

    // Find the React fiber key
    const fiberKey = Object.keys(element).find(key =>
      key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
    );

    if (!fiberKey) return null;

    const fiber = element[fiberKey];

    return {
      type: fiber.type?.name || fiber.type,
      props: fiber.memoizedProps,
      state: fiber.memoizedState,
      key: fiber.key
    };
  });

  console.log('Component info:', JSON.stringify(componentInfo, null, 2));
"
```

### Traversing Component Tree

```bash
# Walk up the component tree
node dist/cli.js eval "
  const componentTree = await page.evaluate(() => {
    const element = document.querySelector('#app');
    const fiberKey = Object.keys(element).find(key =>
      key.startsWith('__reactFiber')
    );

    if (!fiberKey) return [];

    const tree = [];
    let fiber = element[fiberKey];

    while (fiber) {
      if (fiber.type?.name) {
        tree.push({
          name: fiber.type.name,
          props: Object.keys(fiber.memoizedProps || {}),
          hasState: !!fiber.memoizedState
        });
      }
      fiber = fiber.return; // Parent fiber
    }

    return tree;
  });

  console.log('Component tree:', JSON.stringify(componentTree, null, 2));
"
```

---

## Using React DevTools Extension

### Installing React DevTools

The extension can be installed in the persistent browser context.

**Method 1: Manual Installation (Once)**

```bash
# Start session
node dist/cli.js start

# The browser opens visibly - manually install React DevTools:
# 1. Navigate to Chrome Web Store
# 2. Install "React Developer Tools" extension
# 3. Extension persists in .playwright-session/

# Verify installation
node dist/cli.js eval "
  const hasExtension = await page.evaluate(() => {
    return !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });
  console.log('React DevTools installed:', hasExtension);
"
```

**Method 2: Programmatic Installation**

```bash
# Download the extension (do this once, outside the session)
# Visit: https://github.com/facebook/react/tree/main/packages/react-devtools-extensions
# Or use the Chrome Web Store

# Install via context (requires extension path)
node dist/cli.js eval "
  // Note: This requires restarting the browser with extension path
  // For now, manual installation is simpler
  console.log('Use manual installation method instead');
"
```

### Accessing DevTools Global Hook

Once React DevTools is installed:

```bash
node dist/cli.js start
node dist/cli.js eval "await page.goto('http://localhost:3000')"

# Access the global hook
node dist/cli.js eval "
  const devtools = await page.evaluate(() => {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) return { installed: false };

    return {
      installed: true,
      renderers: hook.renderers ? Array.from(hook.renderers.keys()) : [],
      hasRendered: hook.renderers?.size > 0
    };
  });

  console.log('DevTools info:', JSON.stringify(devtools, null, 2));
"
```

### Getting Renderer Instance

```bash
# Get the React renderer
node dist/cli.js eval "
  sharedState.renderer = await page.evaluate(() => {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook?.renderers) return null;

    // Get the first renderer (usually React DOM)
    const rendererId = Array.from(hook.renderers.keys())[0];
    return { rendererId };
  });

  console.log('Renderer:', sharedState.renderer);
"
```

---

## Component State Inspection

### Inspecting Specific Component State

```bash
node dist/cli.js start
node dist/cli.js eval "await page.goto('http://localhost:3000')"

# Method 1: Via fiber (no extension needed)
node dist/cli.js eval "
  const state = await page.evaluate(() => {
    // Find your component by selector
    const element = document.querySelector('[data-component=\"TodoList\"]');
    if (!element) return null;

    const fiberKey = Object.keys(element).find(key =>
      key.startsWith('__reactFiber')
    );

    if (!fiberKey) return null;

    const fiber = element[fiberKey];

    // For function components with hooks
    let hookState = null;
    if (fiber.memoizedState) {
      hookState = [];
      let hook = fiber.memoizedState;

      // Walk the hooks linked list
      while (hook) {
        hookState.push({
          memoizedState: hook.memoizedState,
          queue: hook.queue
        });
        hook = hook.next;
      }
    }

    return {
      componentType: fiber.type?.name || 'Unknown',
      props: fiber.memoizedProps,
      state: fiber.stateNode?.state, // Class component state
      hooks: hookState // Function component hooks
    };
  });

  console.log('Component state:', JSON.stringify(state, null, 2));
"
```

### Watching State Changes

```bash
# Setup state watcher
node dist/cli.js eval "
  await page.evaluate(() => {
    window.__stateHistory = [];

    // Override setState for class components (monkey patch)
    const originalSetState = React.Component.prototype.setState;
    React.Component.prototype.setState = function(update, callback) {
      window.__stateHistory.push({
        timestamp: Date.now(),
        component: this.constructor.name,
        update: JSON.stringify(update)
      });
      return originalSetState.call(this, update, callback);
    };
  });

  console.log('State watcher installed');
"

# Interact with the app
node dist/cli.js eval "await page.click('button.add-todo')"
node dist/cli.js eval "await page.fill('input.todo-text', 'New todo')"
node dist/cli.js eval "await page.click('button.submit')"

# Check state changes
node dist/cli.js eval "
  const history = await page.evaluate(() => window.__stateHistory);
  console.log('State changes:', JSON.stringify(history, null, 2));
"
```

---

## Props and Context Inspection

### Inspecting Props

```bash
node dist/cli.js start
node dist/cli.js eval "await page.goto('http://localhost:3000/product/123')"

# Get props for a component
node dist/cli.js eval "
  const props = await page.evaluate(() => {
    const element = document.querySelector('[data-component=\"ProductCard\"]');
    const fiberKey = Object.keys(element).find(key =>
      key.startsWith('__reactFiber')
    );

    if (!fiberKey) return null;

    return element[fiberKey].memoizedProps;
  });

  console.log('Component props:', JSON.stringify(props, null, 2));
"
```

### Inspecting Context

```bash
# Get context values
node dist/cli.js eval "
  const context = await page.evaluate(() => {
    const element = document.querySelector('#app');
    const fiberKey = Object.keys(element).find(key =>
      key.startsWith('__reactFiber')
    );

    if (!fiberKey) return null;

    const fiber = element[fiberKey];
    const contexts = [];

    let current = fiber;
    while (current) {
      if (current.type?._context) {
        contexts.push({
          name: current.type._context.displayName || 'Context',
          value: current.memoizedProps?.value
        });
      }
      current = current.return;
    }

    return contexts;
  });

  console.log('Context values:', JSON.stringify(context, null, 2));
"
```

---

## Hooks Inspection

### Inspecting useState Hooks

```bash
node dist/cli.js start
node dist/cli.js eval "await page.goto('http://localhost:3000')"

# Get all useState values
node dist/cli.js eval "
  const hooks = await page.evaluate(() => {
    const element = document.querySelector('[data-component=\"Counter\"]');
    const fiberKey = Object.keys(element).find(key =>
      key.startsWith('__reactFiber')
    );

    if (!fiberKey) return null;

    const fiber = element[fiberKey];
    const states = [];

    let hook = fiber.memoizedState;
    let index = 0;

    while (hook) {
      states.push({
        index: index++,
        value: hook.memoizedState,
        // Next hook in the chain
        hasNext: !!hook.next
      });
      hook = hook.next;
    }

    return states;
  });

  console.log('useState hooks:', JSON.stringify(hooks, null, 2));
"
```

### Inspecting useEffect Dependencies

```bash
# Get useEffect dependencies
node dist/cli.js eval "
  const effects = await page.evaluate(() => {
    const element = document.querySelector('[data-component=\"DataFetcher\"]');
    const fiberKey = Object.keys(element).find(key =>
      key.startsWith('__reactFiber')
    );

    if (!fiberKey) return null;

    const fiber = element[fiberKey];

    // updateQueue contains effects
    if (!fiber.updateQueue) return null;

    const effects = [];
    let effect = fiber.updateQueue.effects;

    if (effect) {
      effects.push({
        deps: effect.deps,
        tag: effect.tag
      });
    }

    return effects;
  });

  console.log('useEffect info:', JSON.stringify(effects, null, 2));
"
```

---

## Component Tree Navigation

### Finding All React Components

```bash
node dist/cli.js start
node dist/cli.js eval "await page.goto('http://localhost:3000')"

# Get all components in the tree
node dist/cli.js eval "
  const allComponents = await page.evaluate(() => {
    const components = new Set();

    function traverse(fiber) {
      if (!fiber) return;

      if (fiber.type?.name) {
        components.add(fiber.type.name);
      }

      // Traverse children
      if (fiber.child) traverse(fiber.child);
      if (fiber.sibling) traverse(fiber.sibling);
    }

    const root = document.querySelector('#root');
    const fiberKey = Object.keys(root).find(key =>
      key.startsWith('__reactFiber')
    );

    if (fiberKey) {
      traverse(root[fiberKey]);
    }

    return Array.from(components);
  });

  console.log('All components:', allComponents);
"
```

### Finding Component by Name

```bash
# Find specific component in tree
node dist/cli.js eval "
  const targetComponent = await page.evaluate((name) => {
    function findComponent(fiber, targetName) {
      if (!fiber) return null;

      if (fiber.type?.name === targetName) {
        return {
          name: fiber.type.name,
          props: fiber.memoizedProps,
          state: fiber.memoizedState,
          key: fiber.key
        };
      }

      // Search children
      let result = findComponent(fiber.child, targetName);
      if (result) return result;

      // Search siblings
      return findComponent(fiber.sibling, targetName);
    }

    const root = document.querySelector('#root');
    const fiberKey = Object.keys(root).find(key =>
      key.startsWith('__reactFiber')
    );

    if (!fiberKey) return null;

    return findComponent(root[fiberKey], name);
  }, 'UserProfile');

  console.log('Found component:', JSON.stringify(targetComponent, null, 2));
"
```

---

## Performance Profiling

### Measuring Render Times

```bash
node dist/cli.js start
node dist/cli.js eval "await page.goto('http://localhost:3000')"

# Setup performance monitoring
node dist/cli.js eval "
  await page.evaluate(() => {
    window.__renderMetrics = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure' && entry.name.includes('⚛')) {
          window.__renderMetrics.push({
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime
          });
        }
      }
    });

    observer.observe({ entryTypes: ['measure'] });
  });

  console.log('Performance monitoring started');
"

# Trigger some interactions
node dist/cli.js eval "await page.click('button.load-data')"
node dist/cli.js eval "await page.waitForTimeout(2000)"

# Check metrics
node dist/cli.js eval "
  const metrics = await page.evaluate(() => window.__renderMetrics);
  console.log('Render metrics:', JSON.stringify(metrics, null, 2));
"
```

---

## Complete Example: Debugging React State Issues

```bash
# Start session
node dist/cli.js start

# Navigate to app
node dist/cli.js eval "await page.goto('http://localhost:3000')"

# Initialize debugging state
node dist/cli.js eval "sharedState.reactDebug = {snapshots: []}"

# Take state snapshot before interaction
node dist/cli.js eval "
  const snapshot1 = await page.evaluate(() => {
    const element = document.querySelector('[data-component=\"TodoApp\"]');
    const fiberKey = Object.keys(element).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return null;

    const fiber = element[fiberKey];
    const hooks = [];
    let hook = fiber.memoizedState;

    while (hook) {
      hooks.push(hook.memoizedState);
      hook = hook.next;
    }

    return { timestamp: Date.now(), hooks };
  });

  sharedState.reactDebug.snapshots.push({name: 'initial', data: snapshot1});
  console.log('Initial state:', JSON.stringify(snapshot1, null, 2));
"

# Perform user interaction
node dist/cli.js eval "await page.click('button.add-todo')"
node dist/cli.js eval "await page.fill('input.todo-input', 'Test todo')"
node dist/cli.js eval "await page.click('button.submit')"

# Take state snapshot after interaction
node dist/cli.js eval "
  const snapshot2 = await page.evaluate(() => {
    const element = document.querySelector('[data-component=\"TodoApp\"]');
    const fiberKey = Object.keys(element).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return null;

    const fiber = element[fiberKey];
    const hooks = [];
    let hook = fiber.memoizedState;

    while (hook) {
      hooks.push(hook.memoizedState);
      hook = hook.next;
    }

    return { timestamp: Date.now(), hooks };
  });

  sharedState.reactDebug.snapshots.push({name: 'after-add', data: snapshot2});
  console.log('After state:', JSON.stringify(snapshot2, null, 2));
"

# Compare snapshots
node dist/cli.js eval "
  console.log('State comparison:');
  console.log('Snapshots:', sharedState.reactDebug.snapshots.length);
  console.log(JSON.stringify(sharedState.reactDebug.snapshots, null, 2));
"

# Take screenshot for visual verification
node dist/cli.js eval "await page.screenshot({path: '/tmp/react-debug.png'})"

node dist/cli.js stop
```

---

## Tips for React Inspection

### 1. Use Data Attributes for Easy Selection

Add `data-component` attributes to your components during development:

```jsx
function MyComponent() {
  return <div data-component="MyComponent">...</div>
}
```

### 2. Development vs Production

React internals are minified in production. Use development builds for easier inspection:

```bash
node dist/cli.js eval "
  const isDev = await page.evaluate(() => {
    return typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined';
  });
  console.log('Development mode:', isDev);
"
```

### 3. Save State Snapshots

Use `sharedState` to accumulate state over time:

```bash
node dist/cli.js eval "
  if (!sharedState.stateHistory) sharedState.stateHistory = [];

  const currentState = await page.evaluate(() => {
    // Extract state...
  });

  sharedState.stateHistory.push({
    timestamp: Date.now(),
    state: currentState
  });
"
```

### 4. Component Display Names

Set display names for better debugging:

```jsx
const MyComponent = () => { ... }
MyComponent.displayName = 'MyComponent';
```

### 5. React 18 Concurrent Features

React 18's concurrent rendering can make state inspection tricky. Always capture state after operations settle:

```bash
node dist/cli.js eval "await page.waitForTimeout(100)"  # Let renders settle
```

---

## Limitations

- **React Internals**: These APIs are not public and may change between React versions
- **Minification**: Production builds make inspection harder
- **Fiber Structure**: The internal structure is complex and varies by React version
- **Performance**: Deep tree traversal can be slow on large apps

## Best Practices

1. **Use in Development Only**: Don't rely on internals in production
2. **Add Data Attributes**: Make components easy to find
3. **Snapshot Often**: Save state at key points for comparison
4. **Visual Verification**: Combine state inspection with screenshots
5. **Document React Version**: Different versions have different internal structures

---

## Further Reading

- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
- [React DevTools Backend](https://github.com/facebook/react/tree/main/packages/react-devtools)
- [React Internals Deep Dive](https://blog.isquaredsoftware.com/2020/05/blogged-answers-a-mostly-complete-guide-to-react-rendering-behavior/)
