import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results"
]);
const scannedExtensions = new Set([
  ".cjs",
  ".css",
  ".env",
  ".js",
  ".json",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
]);
const ignoredFiles = new Set(["pnpm-lock.yaml", "scripts/security-scan.mjs"]);

const checks = [
  {
    id: "private-key-block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/
  },
  {
    id: "openai-secret-key",
    pattern: /sk-[A-Za-z0-9_-]{30,}/
  },
  {
    id: "github-token",
    pattern: /gh[pousr]_[A-Za-z0-9_]{30,}/
  },
  {
    id: "wallet-private-key-env",
    pattern: /\b(PRIVATE_KEY|WALLET_PRIVATE_KEY|SEED_PHRASE|MNEMONIC)\s*=\s*["']?(?!$|<|replace|example|test|demo)[^\s"']{12,}/i
  },
  {
    id: "token-approval-or-trade-execution",
    pattern: /\b(approve|setApprovalForAll|permit|executeTrade|swapExact|sendTransaction|writeContract)\s*\(/i
  }
];

async function collectFiles(directory) {
  const entries = await readdir(directory);
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry);
    const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, "/");
    const details = await stat(absolutePath);

    if (details.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        files.push(...(await collectFiles(absolutePath)));
      }
      continue;
    }

    if (ignoredFiles.has(relativePath)) continue;
    if (!scannedExtensions.has(path.extname(entry)) && entry !== ".env.example") continue;
    files.push({ absolutePath, relativePath });
  }

  return files;
}

const findings = [];

for (const file of await collectFiles(root)) {
  const text = await readFile(file.absolutePath, "utf8");
  for (const check of checks) {
    if (check.pattern.test(text)) {
      findings.push(`${file.relativePath}: ${check.id}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Security scan failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Security scan passed.");
