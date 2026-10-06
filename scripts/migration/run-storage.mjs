import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "../..");
const buildDirectory = await mkdtemp(path.join(webRoot, ".storage-build-"));
const outputFile = path.join(buildDirectory, "storage.mjs");

try {
  await build({
    entryPoints: [path.join(scriptDirectory, "storage.ts")],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    packages: "external",
    tsconfig: path.join(webRoot, "tsconfig.json"),
  });
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [outputFile, ...process.argv.slice(2)], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} finally {
  await rm(buildDirectory, { recursive: true, force: true });
}
