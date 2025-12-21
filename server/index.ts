import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import os from "os";

// Type definition for the rawBody addition
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const app = express();
const httpServer = createServer(app);

// 1. BODY PARSERS (Must be at the top)
app.use(express.urlencoded({ extended: false }));
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// 2. LOGGING MIDDLEWARE
// Intercepts JSON responses to log the payload for API debugging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

// log connected client details
app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  log(`Client connected: ${clientIP}`);
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// 3. NETWORK HELPERS
function getNetworkAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const interfaceName in interfaces) {
    const iface = interfaces[interfaceName];
    if (iface) {
      for (const config of iface) {
        // Look for IPv4 addresses that aren't internal (127.0.0.1)
        if (config.family === "IPv4" && !config.internal) {
          addresses.push(config.address);
        }
      }
    }
  }
  return addresses;
}

// 4. MAIN APP LOGIC
(async () => {
  // Register API routes
  await registerRoutes(httpServer, app);

  // Setup Vite (Dev) or Static files (Prod)
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // API 404 handler
  app.use("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

  // Global error handler (MUST be last)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Server error:", err);
    res.status(status).json({ message });
  });

  // START SERVER
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = "0.0.0.0"; // Bind to all interfaces to solve localhost/IP issues

  httpServer.listen(port, host, () => {
    const addresses = getNetworkAddresses();

    log(`✅ Server initialized and listening:`);
    log(`   Local:   http://localhost:${port}`);
    log(`   Loopback: http://127.0.0.1:${port}`);

    addresses.forEach((addr) => {
      log(`   Network: http://${addr}:${port}`);
    });
  });
})();
