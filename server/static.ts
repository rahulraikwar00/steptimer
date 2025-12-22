import path from "path";
import express, { type Express } from "express";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupStaticResouces(app: Express) {
  // Use path.resolve to ensure the path is absolute
  const publicPath = path.resolve(__dirname, "public");

  app.use(express.static(publicPath));

  app.get("*", (req, res, next) => {
    // Only serve index.html if it's not an API route
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(publicPath, "index.html"), (err) => {
      if (err) {
        res.status(500).json({
          message: "Path error",
          error: err.message,
          resolvedPath: path.join(publicPath, "index.html"),
        });
      }
    });
  });
}
