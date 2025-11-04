import http from "node:http";
import { MultiExecutor } from "./multi-executor.js";

const PORT = 45123;
const executor = new MultiExecutor();

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "POST" && req.url === "/start") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const { sessionId = "default" } = body ? JSON.parse(body) : {};

        if (executor.hasSession(sessionId)) {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: false,
            error: `Session '${sessionId}' already started`
          }));
          return;
        }

        // Initialize by executing empty code - this ensures browser is ready
        await executor.execute(sessionId, "// Session initialized");

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          sessionId,
          message: `Session '${sessionId}' started`
        }));
      } catch (error) {
        res.writeHead(500);
        res.end(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });
  } else if (req.method === "POST" && req.url === "/eval") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const { sessionId = "default", code } = JSON.parse(body);

        if (!code) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: "Missing 'code' parameter" }));
          return;
        }

        const result = await executor.execute(sessionId, code);
        res.writeHead(200);
        res.end(JSON.stringify({ ...result, sessionId }, null, 2));
      } catch (error) {
        res.writeHead(500);
        res.end(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });
  } else if (req.method === "POST" && req.url === "/stop") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const { sessionId = "default" } = body ? JSON.parse(body) : {};

        if (!executor.hasSession(sessionId)) {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: false,
            error: `No session '${sessionId}' to stop`
          }));
          return;
        }

        await executor.cleanupSession(sessionId);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          sessionId,
          message: `Session '${sessionId}' stopped`
        }));
      } catch (error) {
        res.writeHead(500);
        res.end(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });
  } else if (req.method === "GET" && req.url === "/sessions") {
    const sessions = executor.listSessions();
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      sessions,
      count: sessions.length
    }));
  } else if (req.method === "GET" && req.url === "/health") {
    const sessions = executor.listSessions();
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "ok",
      activeSessions: sessions.length,
      sessions
    }));
  } else if (req.method === "POST" && req.url === "/shutdown") {
    await executor.cleanupAll();
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, message: "Server shutting down" }));
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 100);
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

process.on("SIGINT", async () => {
  console.error("\nGracefully shutting down...");
  await executor.cleanupAll();
  server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("Gracefully shutting down...");
  await executor.cleanupAll();
  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.error(`Playwright session server listening on http://localhost:${PORT}`);
});
