import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import os from "os";
import path from "path";

// Type definition for the rawBody addition
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const app = express();
const httpServer = createServer(app);

// 1. BODY PARSERS
app.use(express.urlencoded({ extended: false }));
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// 2. LOGGING & HELPERS
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

function getNetworkAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name in interfaces) {
    const iface = interfaces[name];
    if (iface) {
      for (const config of iface) {
        if (config.family === "IPv4" && !config.internal) {
          addresses.push(config.address);
        }
      }
    }
  }
  return addresses;
}

// 3. MAIN APP LOGIC
(async () => {
  // Register API routes FIRST so they aren't caught by static wildcards
  await registerRoutes(httpServer, app);

  if (process.env.NODE_ENV === "production") {
    const publicPath = path.join(__dirname, "public");
    app.use(express.static(publicPath));

    // Handle SPA routing: serve index.html for any unknown route
    app.get("*", (req, res) => {
      res.sendFile(path.join(publicPath, "index.html"));
    });
  } else {
    // In development, we use Vite's middleware
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // API 404 handler
  app.use("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Server error:", err);
    res.status(status).json({ message });
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    const addresses = getNetworkAddresses();
    log(`✅ Server listening on port ${port}`);
    addresses.forEach((addr) => log(`   Network: http://${addr}:${port}`));
  });
})();

// Vercel needs the app exported to handle it as a Serverless Function
export default app;
