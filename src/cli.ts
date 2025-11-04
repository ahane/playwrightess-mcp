#!/usr/bin/env node

import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";

const PORT = 45123;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PID_FILE = join(__dirname, "../.session-server.pid");

function httpRequest(
  method: string,
  path: string,
  data?: any
): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: PORT,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk.toString();
      });
      res.on("end", () => {
        resolve(body);
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function isServerRunning(): Promise<boolean> {
  try {
    await httpRequest("GET", "/health");
    return true;
  } catch {
    return false;
  }
}

async function startServer() {
  const serverPath = join(__dirname, "server.js");

  const child = spawn("node", [serverPath], {
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  fs.writeFileSync(PID_FILE, child.pid!.toString());

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const running = await isServerRunning();
  if (!running) {
    throw new Error("Failed to start server");
  }
}

async function stopServer() {
  try {
    await httpRequest("POST", "/shutdown");
  } catch {
    // Server might already be down
  }

  if (fs.existsSync(PID_FILE)) {
    try {
      const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8"));
      process.kill(pid, "SIGTERM");
    } catch {
      // Process might already be dead
    }
    fs.unlinkSync(PID_FILE);
  }
}

async function start(sessionId: string = "default") {
  const running = await isServerRunning();

  if (running) {
    // Server is running, initialize session
    try {
      const response = await httpRequest("POST", "/start", { sessionId });
      console.log(response);
    } catch (error) {
      console.log(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  } else {
    // Start server first, then initialize session
    try {
      await startServer();
      const response = await httpRequest("POST", "/start", { sessionId });
      console.log(response);
    } catch (error) {
      console.log(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
}

async function evaluate(code: string, sessionId: string = "default") {
  const running = await isServerRunning();

  if (!running) {
    console.log(
      JSON.stringify({
        success: false,
        error: "Server not running. Run 'start' first.",
      })
    );
    return;
  }

  try {
    const response = await httpRequest("POST", "/eval", { code, sessionId });
    console.log(response);
  } catch (error) {
    console.log(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

async function stop(sessionId: string = "default") {
  const running = await isServerRunning();

  if (!running) {
    console.log(
      JSON.stringify({
        success: false,
        error: "Server not running",
      })
    );
    return;
  }

  try {
    const response = await httpRequest("POST", "/stop", { sessionId });
    console.log(response);
  } catch (error) {
    console.log(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

async function listSessions() {
  const running = await isServerRunning();

  if (!running) {
    console.log(
      JSON.stringify({
        success: false,
        error: "Server not running",
      })
    );
    return;
  }

  try {
    const response = await httpRequest("GET", "/sessions");
    console.log(response);
  } catch (error) {
    console.log(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

async function shutdown() {
  try {
    await stopServer();
    console.log(
      JSON.stringify({
        success: true,
        message: "Server shut down",
      })
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(`
Usage:
  playwright-session start [--session <name>]      - Start a persistent browser session
  playwright-session eval "<code>" [--session <name>] - Execute JavaScript code
  playwright-session stop [--session <name>]       - Stop a session
  playwright-session sessions                      - List active sessions
  playwright-session shutdown                      - Shutdown the background server
  playwright-session status                        - Check server status

Options:
  --session <name>    Session identifier (default: "default")

Examples:
  playwright-session start
  playwright-session start --session user1
  playwright-session eval "await page.goto('http://example.com')"
  playwright-session eval "await page.goto('http://example.com')" --session user2
  playwright-session eval "await page.screenshot({path: '/tmp/test.png'})"
  playwright-session sessions
  playwright-session stop --session user1
  playwright-session shutdown
`);
    process.exit(1);
  }

  // Parse --session parameter
  let sessionId = "default";
  const sessionIndex = args.indexOf("--session");
  if (sessionIndex !== -1 && args[sessionIndex + 1]) {
    sessionId = args[sessionIndex + 1];
    // Remove --session and its value from args
    args.splice(sessionIndex, 2);
  }

  const command = args[0];

  switch (command) {
    case "start":
      await start(sessionId);
      break;

    case "eval":
      if (args.length < 2) {
        console.error('Error: "eval" command requires code argument');
        process.exit(1);
      }
      const code = args.slice(1).join(" ");
      await evaluate(code, sessionId);
      break;

    case "stop":
      await stop(sessionId);
      break;

    case "sessions":
      await listSessions();
      break;

    case "shutdown":
      await shutdown();
      break;

    case "status":
      const running = await isServerRunning();
      if (running) {
        const response = await httpRequest("GET", "/health");
        console.log(response);
      } else {
        console.log(
          JSON.stringify({
            serverRunning: false,
          })
        );
      }
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
