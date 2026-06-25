/**
 * Restore a MinIO Docker volume from a backup archive.
 *
 * Usage:
 *   node scripts/minio-restore.mjs backups/minio-data_2026-06-25_120000.tar.gz
 *   node scripts/minio-restore.mjs --volume gp_minio-data --force backups/minio-data_2026-06-25_120000.tar.gz
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve as resolvePath } from "node:path";

const repoRoot = resolvePath(import.meta.dirname, "..");

function readArgs(argv) {
  let composeFile = "docker-compose.prod.yml";
  let envFile = ".env.production";
  let volumeName;
  let force = false;
  let backupFile;

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
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (!backupFile) {
      backupFile = arg;
    }
  }

  return {
    composeFile,
    envFile,
    volumeName,
    force,
    backupFile,
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
    const error = new Error(`${command} ${args.join(" ")} failed: ${detail}`);
    error.code = result.status;
    throw error;
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

try {
  const { composeFile, envFile, volumeName, force, backupFile } = readArgs(process.argv.slice(2));
  if (!backupFile) {
    throw new Error("Usage: node scripts/minio-restore.mjs [--force] [--volume <name>] <backup-file>");
  }

  const resolvedBackupFile = resolvePath(repoRoot, backupFile);
  if (!existsSync(resolvedBackupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  const resolvedVolume = volumeName || resolveMinioVolumeName(composeFile, envFile);
  run("docker", ["volume", "inspect", resolvedVolume], { stdio: "pipe" });

  const backupDir = resolvePath(resolvedBackupFile, "..");
  const backupFileName = resolvedBackupFile.split(/[\\/]/).pop();
  const backupDirUnix = backupDir.replace(/\\/g, "/");

  console.log("=== MinIO Restore ===");
  console.log(`Volume      : ${resolvedVolume}`);
  console.log(`Backup file : ${backupFile}`);
  console.log("");

  if (!force) {
    const check = spawnSync("docker", [
      "run",
      "--rm",
      "-v",
      `${resolvedVolume}:/data`,
      "alpine:3.22",
      "sh",
      "-c",
      'if [ -n "$(ls -A /data 2>/dev/null)" ]; then exit 10; fi',
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (check.status === 10) {
      throw new Error("Target MinIO volume is not empty. Re-run with --force to allow destructive restore.");
    }
    if (check.status !== 0) {
      const detail = (check.stderr || check.stdout || "").trim() || `exit ${check.status}`;
      throw new Error(`Failed to inspect target MinIO volume: ${detail}`);
    }
  }

  console.log(force ? "Restoring archive into MinIO volume with destructive overwrite..." : "Restoring archive into empty MinIO volume...");

  run("docker", [
    "run",
    "--rm",
    "-v",
    `${resolvedVolume}:/data`,
    "-v",
    `${backupDirUnix}:/backup:ro`,
    "alpine:3.22",
    "sh",
    "-c",
    force
      ? `rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null || true; tar -xzf "/backup/${backupFileName}" -C /data`
      : `tar -xzf "/backup/${backupFileName}" -C /data`,
  ], { stdio: "inherit" });

  console.log("");
  console.log(`MinIO restore complete from ${backupFile}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
