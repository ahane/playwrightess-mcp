import * as vm from "node:vm";
import * as playwright from "playwright";
import { createRequire } from "node:module";
import assert from "node:assert";
import { SingleBrowserSessionManager } from "./session-manager.js";
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

export class CodeExecutor {
  private context!: vm.Context;
  private isInitialized = false;
  private sessionManager: SingleBrowserSessionManager;
  private consoleMessages: string[] = [];
  private sessionConsoleMessages: string[] = [];
  private consoleHandlerRegistered = false;

  constructor() {
    this.sessionManager = SingleBrowserSessionManager.getInstance();
  }

  async initialize() {
    await this.initializeContext();
  }

  private async initializeContext() {
    const require = createRequire(import.meta.url);

    const sessionConsole = {
      log: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        this.sessionConsoleMessages.push(`[LOG] ${message}`);
        console.log(...args);
      },
      warn: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        this.sessionConsoleMessages.push(`[WARN] ${message}`);
        console.warn(...args);
      },
      error: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        this.sessionConsoleMessages.push(`[ERROR] ${message}`);
        console.error(...args);
      },
      info: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        this.sessionConsoleMessages.push(`[INFO] ${message}`);
        console.info(...args);
      },
      debug: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        this.sessionConsoleMessages.push(`[DEBUG] ${message}`);
        console.debug(...args);
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
      sharedState: {},
      assert,
    };

    this.context = vm.createContext(contextObject);
    this.isInitialized = true;

    vm.runInContext(
      "const global = globalThis; const self = globalThis;",
      this.context
    );
  }

  private async ensurePlaywrightInitialized() {
    const browser = vm.runInContext(
      "typeof browser !== 'undefined' ? browser : null",
      this.context
    );
    const context = vm.runInContext(
      "typeof context !== 'undefined' ? context : null",
      this.context
    );
    const page = vm.runInContext(
      "typeof page !== 'undefined' ? page : null",
      this.context
    );

    if (!browser || !context || !page) {
      const browserInstance = await this.sessionManager.ensureBrowser();
      const contextInstance = await this.sessionManager.ensureContext();
      const pageInstance = await this.sessionManager.ensurePage();

      this.context.browser = browserInstance;
      this.context.context = contextInstance;
      this.context.page = pageInstance;

      vm.runInContext(
        `
        globalThis.browser = browser;
        globalThis.context = context;
        globalThis.page = page;
      `,
        this.context
      );

      this.registerConsoleHandler(pageInstance);
    }
  }

  private registerConsoleHandler(page: playwright.Page) {
    if (!this.consoleHandlerRegistered) {
      page.on("console", (msg) => {
        this.consoleMessages.push(msg.text());
      });
      this.consoleHandlerRegistered = true;
    }
  }

  async execute(code: string): Promise<ExecutionResult> {
    if (!this.isInitialized) {
      throw new Error("Executor not initialized");
    }

    try {
      await this.ensurePlaywrightInitialized();

      const rewrittenCode = rewriteCodeToTrackVariables(code);

      const wrappedCode = `(async () => {
  ${rewrittenCode}
})()`;

      const result = vm.runInContext(wrappedCode, this.context);

      const finalResult = await result;

      const browserConsoleLogs = [...this.consoleMessages];
      const sessionConsoleLogs = [...this.sessionConsoleMessages];
      this.consoleMessages.length = 0;
      this.sessionConsoleMessages.length = 0;

      return {
        success: true,
        result: finalResult !== undefined ? finalResult : undefined,
        browserConsoleLogs,
        sessionConsoleLogs,
      };
    } catch (error) {
      const browserConsoleLogs = [...this.consoleMessages];
      const sessionConsoleLogs = [...this.sessionConsoleMessages];
      this.consoleMessages.length = 0;
      this.sessionConsoleMessages.length = 0;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        browserConsoleLogs,
        sessionConsoleLogs,
      };
    }
  }

  async cleanup() {
    await this.sessionManager.saveStorageState();
    await this.sessionManager.cleanup();
  }
}
