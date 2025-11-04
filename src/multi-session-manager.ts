import * as playwright from "playwright";
import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";

interface BrowserSession {
  browser: playwright.Browser | null;
  context: playwright.BrowserContext | null;
  page: playwright.Page | null;
  userDataDir: string;
  storageStatePath: string;
}

export class MultiSessionManager {
  private static instance: MultiSessionManager;
  private sessions: Map<string, BrowserSession> = new Map();
  private sessionsDir: string;
  private storageStatesDir: string;

  private constructor() {
    this.sessionsDir = path.join(process.cwd(), ".playwright-sessions");
    this.storageStatesDir = path.join(process.cwd(), ".playwright-storage-states");

    // Create directories if they don't exist
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    if (!fs.existsSync(this.storageStatesDir)) {
      fs.mkdirSync(this.storageStatesDir, { recursive: true });
    }
  }

  static getInstance(): MultiSessionManager {
    if (!MultiSessionManager.instance) {
      MultiSessionManager.instance = new MultiSessionManager();
    }
    return MultiSessionManager.instance;
  }

  private async killExistingChromiumProcesses(): Promise<void> {
    return new Promise((resolve) => {
      const killProcess = spawn("pkill", ["-f", "chromium.*--user-data-dir"]);
      killProcess.on("close", () => resolve());
    });
  }

  async ensureSession(sessionId: string): Promise<BrowserSession> {
    if (!this.sessions.has(sessionId)) {
      const userDataDir = path.join(this.sessionsDir, sessionId);
      const storageStatePath = path.join(this.storageStatesDir, `${sessionId}-state.json`);

      // Create user data directory if it doesn't exist
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }

      this.sessions.set(sessionId, {
        browser: null,
        context: null,
        page: null,
        userDataDir,
        storageStatePath,
      });
    }

    return this.sessions.get(sessionId)!;
  }

  async ensureBrowser(sessionId: string): Promise<playwright.Browser> {
    const session = await this.ensureSession(sessionId);

    if (!session.browser || !session.browser.isConnected()) {
      // Use launchPersistentContext for this session
      session.context = await playwright.chromium.launchPersistentContext(
        session.userDataDir,
        {
          headless: false,
          args: [
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
            "--no-first-run",
            "--disable-default-apps",
          ],
          viewport: { width: 1280, height: 720 },
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      );

      // Get the browser from the persistent context
      session.browser = session.context.browser()!;

      session.browser.on("disconnected", () => {
        console.error(`Browser disconnected for session: ${sessionId}`);
        session.browser = null;
        session.context = null;
        session.page = null;
      });

      session.context.setDefaultNavigationTimeout(8000);
      session.context.setDefaultTimeout(8000);
    }

    return session.browser;
  }

  async ensureContext(sessionId: string): Promise<playwright.BrowserContext> {
    const session = await this.ensureSession(sessionId);

    if (!session.context) {
      // Context is created in ensureBrowser() via launchPersistentContext
      await this.ensureBrowser(sessionId);
    }

    return session.context!;
  }

  async ensurePage(sessionId: string): Promise<playwright.Page> {
    const session = await this.ensureSession(sessionId);

    if (!session.page || session.page.isClosed()) {
      const context = await this.ensureContext(sessionId);
      session.page = await context.newPage();
    }

    return session.page;
  }

  async saveStorageState(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session?.context) {
      await session.context.storageState({ path: session.storageStatePath });
    }
  }

  async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      if (session.page && !session.page.isClosed()) {
        await session.page.close();
      }
    } catch (error) {
      console.error(`Error closing page for session ${sessionId}:`, error);
    }

    try {
      if (session.context) {
        await session.context.close();
      }
    } catch (error) {
      console.error(`Error closing context for session ${sessionId}:`, error);
    }

    try {
      if (session.browser && session.browser.isConnected()) {
        await session.browser.close();
      }
    } catch (error) {
      console.error(`Error closing browser for session ${sessionId}:`, error);
    }

    session.page = null;
    session.context = null;
    session.browser = null;
    this.sessions.delete(sessionId);
  }

  async cleanupAll(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.cleanupSession(sessionId);
    }
    await this.killExistingChromiumProcesses();
  }

  getBrowser(sessionId: string): playwright.Browser | null {
    return this.sessions.get(sessionId)?.browser || null;
  }

  getContext(sessionId: string): playwright.BrowserContext | null {
    return this.sessions.get(sessionId)?.context || null;
  }

  getPage(sessionId: string): playwright.Page | null {
    return this.sessions.get(sessionId)?.page || null;
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}
