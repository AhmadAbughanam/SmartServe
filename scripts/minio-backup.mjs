/**
 * Backup the configured MinIO Docker volume into backups/minio-data_*.tar.gz.
 *
 * Usage:
 *   node scripts/minio-backup.mjs
 *   node scripts/minio-backup.mjs --compose-file docker-compose.prod.yml --env-file .env.production
 *   node scripts/minio-backup.mjs --volume gp_minio-data
 */

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "..");

function readArgs(argv) {
  let composeFile = "docker-compose.prod.yml";
  let envFile = ".env.production";
  let volumeName;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--compose-file") {
      composeFile = argv[i + 1] ?? composeFile;
      i += 1;
      continue;
    }
    if (arg === "--env-file") {
      envFile = argv[i + 1] ?? envFile;
      i += 1;
      continue;
    }
    if (arg === "--volume") {
      volumeName = argv[i + 1];
      i += 1;
    }
  }

  return {
    composeFile,
    envFile,
    volumeName,
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim() || `exit ${result.status}`;
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }
  return result.stdout;
}

function resolveMinioVolumeName(composeFile, envFile) {
  const output = run("docker", ["compose", "-f", composeFile, "--env-file", envFile, "config"]);
  const lines = output.split(/\r?\n/);
  let inVolumes = false;
  let inMinioVolume = false;
  for (const line of lines) {
    if (!inVolumes && line === "volumes:") {
      inVolumes = true;
      continue;
    }
    if (!inVolumes) continue;
    if (!line.startsWith("  ") && line.trim() !== "") {
      break;
    }
    if (line === "  minio-data:") {
      inMinioVolume = true;
      continue;
    }
    if (inMinioVolume && line.startsWith("    name:")) {
      return line.slice("    name:".length).trim();
    }
    if (inMinioVolume && line.startsWith("  ") && !line.startsWith("    ")) {
      break;
    }
  }
  throw new Error("Could not resolve minio-data volume name from docker compose config");
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

try {
  const { composeFile, envFile, volumeName } = readArgs(process.argv.slice(2));
  const resolvedVolume = volumeName || resolveMinioVolumeName(composeFile, envFile);
  const backupDir = resolve(repoRoot, "backups");
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  run("docker", ["volume", "inspect", resolvedVolume], { stdio: "pipe" });

  const backupFileName = `minio-data_${timestamp()}.tar.gz`;
  const backupDirUnix = backupDir.replace(/\\/g, "/");

  console.log("=== MinIO Backup ===");
  console.log(`Volume     : ${resolvedVolume}`);
  console.log(`Output dir : ${backupDir}`);
  console.log(`Archive    : ${backupFileName}`);
  console.log("");
  console.log("Creating MinIO volume archive...");

  run("docker", [
    "run",
    "--rm",
    "-v",
    `${resolvedVolume}:/data:ro`,
    "-v",
    `${backupDirUnix}:/backup`,
    "alpine:3.22",
    "sh",
    "-c",
    `tar -czf "/backup/${backupFileName}" -C /data .`,
  ], { stdio: "inherit" });

  console.log("");
  console.log(`MinIO backup complete: backups/${backupFileName}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
