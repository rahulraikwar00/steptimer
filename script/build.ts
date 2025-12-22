import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, mkdir, cp } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

async function buildAll() {
  try {
    console.log("🚀 Starting Full-Stack Build...");

    // 1. Clean previous builds
    console.log("🧹 Cleaning dist folder...");
    await rm(path.join(root, "dist"), { recursive: true, force: true });

    // 2. Build Frontend (Vite)
    // This will use your vite.config.ts which is set to output to dist/public
    console.log("📦 Compiling Frontend (Vite)...");
    await viteBuild({
      configFile: path.join(root, "vite.config.ts"),
    });

    // 3. Build Backend (ESBuild)
    console.log("⚙️ Bundling Server (ESBuild)...");
    await esbuild({
      entryPoints: [path.join(root, "server/index.ts")],
      bundle: true,
      platform: "node",
      target: "node20",
      format: "cjs",
      outfile: path.join(root, "dist/index.cjs"),
      minify: true,
      sourcemap: true,
      // Externalize native drivers that don't bundle well
      external: ["pg", "sqlite3", "bufferutil", "utf-8-validate"],
      define: {
        "process.env.NODE_ENV": '"production"',
      },
    });

    console.log("\n✅ Build Successful!");
    console.log("-----------------------");
    console.log("Main Entry: dist/index.cjs");
    console.log("Static Assets: dist/public/");
    console.log("-----------------------");
  } catch (error) {
    console.error("❌ Build Failed:", error);
    process.exit(1);
  }
}

buildAll();
