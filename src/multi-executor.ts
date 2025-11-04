import * as vm from "node:vm";
import * as playwright from "playwright";
import { createRequire } from "node:module";
import assert from "node:assert";
import { MultiSessionManager } from "./multi-session-manager.js";
import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
// @ts-ignore
const traverseDefault = traverse.default || traverse;
import * as t from "@babel/types";
import generate from "@babel/generator";
// @ts-ignore
const generateDefault = generate.default || generate;

const TRACKED_VARIABLES = new Set([
  "page",
  "browser",
  "context",
  "sessionManager",
]);

function rewriteCodeToTrackVariables(code: string): string {
  try {
    const ast = parse(code, {
      sourceType: "module",
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      plugins: ["typescript", "jsx"],
    });

    traverseDefault(ast, {
      VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
        const id = path.node.id;
        if (t.isIdentifier(id) && TRACKED_VARIABLES.has(id.name)) {
          const assignment = t.assignmentExpression(
            "=",
            t.memberExpression(
              t.identifier("globalThis"),
              t.identifier(id.name)
            ),
            t.identifier(id.name)
          );
          const expressionStatement = t.expressionStatement(assignment);

          const parent = path.getFunctionParent() || path.getStatementParent();
          if (parent) {
            parent.insertAfter(expressionStatement);
          }
        }
      },

      AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
        const left = path.node.left;
        if (t.isIdentifier(left) && TRACKED_VARIABLES.has(left.name)) {
          const globalAssignment = t.assignmentExpression(
            "=",
            t.memberExpression(
              t.identifier("globalThis"),
              t.identifier(left.name)
            ),
            t.identifier(left.name)
          );
          const expressionStatement = t.expressionStatement(globalAssignment);

          const parent = path.getStatementParent();
          if (parent) {
            parent.insertAfter(expressionStatement);
          }
        }
      },
    });

    return generateDefault(ast).code;
  } catch (error) {
    console.error("AST parsing/rewriting failed:", error);
    return code;
  }
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  stack?: string;
  browserConsoleLogs: string[];
  sessionConsoleLogs: string[];
}

export class MultiExecutor {
  private contexts: Map<string, vm.Context> = new Map();
  private consoleMessages: Map<string, string[]> = new Map();
  private sessionConsoleMessages: Map<string, string[]> = new Map();
  private consoleHandlersRegistered: Set<string> = new Set();
  private sessionManager: MultiSessionManager;

  constructor() {
    this.sessionManager = MultiSessionManager.getInstance();
  }

  private async initializeContext(sessionId: string) {
    const require = createRequire(import.meta.url);

    const sessionConsole = {
      log: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        const logs = this.sessionConsoleMessages.get(sessionId) || [];
        logs.push(`[LOG] ${message}`);
        this.sessionConsoleMessages.set(sessionId, logs);
        console.log(`[${sessionId}]`, ...args);
      },
      warn: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        const logs = this.sessionConsoleMessages.get(sessionId) || [];
        logs.push(`[WARN] ${message}`);
        this.sessionConsoleMessages.set(sessionId, logs);
        console.warn(`[${sessionId}]`, ...args);
      },
      error: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        const logs = this.sessionConsoleMessages.get(sessionId) || [];
        logs.push(`[ERROR] ${message}`);
        this.sessionConsoleMessages.set(sessionId, logs);
        console.error(`[${sessionId}]`, ...args);
      },
      info: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        const logs = this.sessionConsoleMessages.get(sessionId) || [];
        logs.push(`[INFO] ${message}`);
        this.sessionConsoleMessages.set(sessionId, logs);
        console.info(`[${sessionId}]`, ...args);
      },
      debug: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        const logs = this.sessionConsoleMessages.get(sessionId) || [];
        logs.push(`[DEBUG] ${message}`);
        this.sessionConsoleMessages.set(sessionId, logs);
        console.debug(`[${sessionId}]`, ...args);
      },
    };

    const contextObject = {
      console: sessionConsole,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      Buffer,
      process,
      require,
      URL,
      URLSearchParams,
      playwright,
      chromium: playwright.chromium,
      firefox: playwright.firefox,
      webkit: playwright.webkit,
      devices: playwright.devices,
      sessionManager: this.sessionManager,
      sessionId: sessionId,
      sharedState: {},
      assert,
    };

    const context = vm.createContext(contextObject);
    this.contexts.set(sessionId, context);
    this.consoleMessages.set(sessionId, []);
    this.sessionConsoleMessages.set(sessionId, []);

    vm.runInContext(
      "const global = globalThis; const self = globalThis;",
      context
    );
  }

  private async ensurePlaywrightInitialized(sessionId: string) {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error(`Session ${sessionId} not initialized`);
    }

    const browser = vm.runInContext(
      "typeof browser !== 'undefined' ? browser : null",
      context
    );
    const contextVar = vm.runInContext(
      "typeof context !== 'undefined' ? context : null",
      context
    );
    const page = vm.runInContext(
      "typeof page !== 'undefined' ? page : null",
      context
    );

    if (!browser || !contextVar || !page) {
      const browserInstance = await this.sessionManager.ensureBrowser(sessionId);
      const contextInstance = await this.sessionManager.ensureContext(sessionId);
      const pageInstance = await this.sessionManager.ensurePage(sessionId);

      context.browser = browserInstance;
      context.context = contextInstance;
      context.page = pageInstance;

      vm.runInContext(
        `
        globalThis.browser = browser;
        globalThis.context = context;
        globalThis.page = page;
      `,
        context
      );

      this.registerConsoleHandler(sessionId, pageInstance);
    }
  }

  private registerConsoleHandler(sessionId: string, page: playwright.Page) {
    if (!this.consoleHandlersRegistered.has(sessionId)) {
      page.on("console", (msg) => {
        const logs = this.consoleMessages.get(sessionId) || [];
        logs.push(msg.text());
        this.consoleMessages.set(sessionId, logs);
      });
      this.consoleHandlersRegistered.add(sessionId);
    }
  }

  async execute(sessionId: string, code: string): Promise<ExecutionResult> {
    if (!this.contexts.has(sessionId)) {
      await this.initializeContext(sessionId);
    }

    const context = this.contexts.get(sessionId)!;

    try {
      await this.ensurePlaywrightInitialized(sessionId);

      const rewrittenCode = rewriteCodeToTrackVariables(code);

      const wrappedCode = `(async () => {
  ${rewrittenCode}
})()`;

      const result = vm.runInContext(wrappedCode, context);

      const finalResult = await result;

      const browserConsoleLogs = [...(this.consoleMessages.get(sessionId) || [])];
      const sessionConsoleLogs = [...(this.sessionConsoleMessages.get(sessionId) || [])];
      this.consoleMessages.set(sessionId, []);
      this.sessionConsoleMessages.set(sessionId, []);

      return {
        success: true,
        result: finalResult !== undefined ? finalResult : undefined,
        browserConsoleLogs,
        sessionConsoleLogs,
      };
    } catch (error) {
      const browserConsoleLogs = [...(this.consoleMessages.get(sessionId) || [])];
      const sessionConsoleLogs = [...(this.sessionConsoleMessages.get(sessionId) || [])];
      this.consoleMessages.set(sessionId, []);
      this.sessionConsoleMessages.set(sessionId, []);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        browserConsoleLogs,
        sessionConsoleLogs,
      };
    }
  }

  async cleanupSession(sessionId: string) {
    await this.sessionManager.saveStorageState(sessionId);
    await this.sessionManager.cleanupSession(sessionId);
    this.contexts.delete(sessionId);
    this.consoleMessages.delete(sessionId);
    this.sessionConsoleMessages.delete(sessionId);
    this.consoleHandlersRegistered.delete(sessionId);
  }

  async cleanupAll() {
    const sessionIds = Array.from(this.contexts.keys());
    for (const sessionId of sessionIds) {
      await this.cleanupSession(sessionId);
    }
    await this.sessionManager.cleanupAll();
  }

  listSessions(): string[] {
    return this.sessionManager.listSessions();
  }

  hasSession(sessionId: string): boolean {
    return this.contexts.has(sessionId);
  }
}
