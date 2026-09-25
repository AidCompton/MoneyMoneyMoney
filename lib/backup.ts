import "server-only";
import fs from "node:fs";
import path from "node:path";
import { dataDir, sqlite } from "@/db";

// Backups are full copies of the database, made with SQLite's own backup API
// so they include changes still sitting in the write-ahead log. They live in
// data/backups next to the database, named by time so they sort in order.

export const BACKUP_NAME = /^app-[0-9T-]+Z?\.db$/;

export function backupDir() {
  return path.join(dataDir, "backups");
}

export async function createBackup() {
  fs.mkdirSync(backupDir(), { recursive: true });
  const name = `app-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
  await sqlite.backup(path.join(backupDir(), name));
  return name;
}

export function listBackups() {
  if (!fs.existsSync(backupDir())) return [];
  return fs
    .readdirSync(backupDir())
    .filter((name) => BACKUP_NAME.test(name))
    .map((name) => {
      const stat = fs.statSync(path.join(backupDir(), name));
      return { name, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
