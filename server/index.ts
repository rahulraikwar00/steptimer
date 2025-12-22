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
if (process.env.NODE_ENV === "production") {
  // Use path.resolve to ensure Vercel sees the absolute path from the root of the deployment
  const publicPath = path.resolve(__dirname, "public");

  // Serve static assets (js, css, images)
  app.use(
    express.static(publicPath, {
      maxAge: "1d", // Optional: adds caching for assets
      index: false, // Prevents it from automatically serving index.html before we want it to
    })
  );

  // Handle SPA routing: serve index.html for any unknown non-API route
  app.get("*", (req, res) => {
    // If the request is for an API that doesn't exist, don't serve index.html
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ message: "API endpoint not found" });
    }

    const indexPath = path.join(publicPath, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error("Error sending index.html:", err);
        res.status(500).send("Internal Server Error: Missing frontend build");
      }
    });
  });
}
// Vercel needs the app exported to handle it as a Serverless Function
export default app;
