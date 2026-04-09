import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORD_LIST_HEADER = [
  "# Blacklisted words and phrases used by automated moderation.",
  "# Use /addbadword, /removebadword, and /reloadwords commands to manage this list."
].join("\n");

function resolveWordsFilePath(): string {
  const fromEnv = (process.env.WORDS_PATH ?? "").trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceDir = path.resolve(moduleDir, "../../..");
  return path.resolve(workspaceDir, "bot/words.py");
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function decodePythonLikeString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, "\"")
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
}

function parseWords(content: string): string[] {
  const assignment = content.match(/blat\s*=\s*\[([\s\S]*?)\]/m);
  if (!assignment) {
    return [];
  }

  const listBody = assignment[1];
  const matcher = /(['"])((?:\\.|(?!\1)[\s\S])*)\1/g;
  const words: string[] = [];

  let match: RegExpExecArray | null = null;
  while ((match = matcher.exec(listBody)) !== null) {
    const decoded = decodePythonLikeString(match[2]);
    const normalized = normalizeWord(decoded);
    if (normalized) {
      words.push(normalized);
    }
  }

  return Array.from(new Set(words)).sort();
}

function serializeWords(words: string[]): string {
  const normalized = Array.from(new Set(words.map(normalizeWord).filter(Boolean))).sort();
  const payload = JSON.stringify(normalized);
  return `${WORD_LIST_HEADER}\nblat = ${payload}\n`;
}

function ensureWordsFile(filePath: string): void {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${WORD_LIST_HEADER}\nblat = []\n`, "utf-8");
  }
}

function readWords(filePath: string): string[] {
  ensureWordsFile(filePath);
  const content = fs.readFileSync(filePath, "utf-8");
  return parseWords(content);
}

function writeWords(filePath: string, words: string[]): string[] {
  const normalized = Array.from(new Set(words.map(normalizeWord).filter(Boolean))).sort();
  fs.writeFileSync(filePath, serializeWords(normalized), "utf-8");
  return normalized;
}

export function listBlacklistedWords(): string[] {
  const filePath = resolveWordsFilePath();
  return readWords(filePath);
}

export function addBlacklistedWord(word: string): { added: boolean; words: string[] } {
  const normalized = normalizeWord(word);
  if (!normalized) {
    throw new Error("word cannot be empty");
  }

  const filePath = resolveWordsFilePath();
  const current = readWords(filePath);
  if (current.includes(normalized)) {
    return { added: false, words: current };
  }

  const updated = writeWords(filePath, [...current, normalized]);
  return { added: true, words: updated };
}

export function removeBlacklistedWord(word: string): { removed: boolean; words: string[] } {
  const normalized = normalizeWord(word);
  if (!normalized) {
    throw new Error("word cannot be empty");
  }

  const filePath = resolveWordsFilePath();
  const current = readWords(filePath);
  if (!current.includes(normalized)) {
    return { removed: false, words: current };
  }

  const updated = writeWords(
    filePath,
    current.filter((entry) => entry !== normalized)
  );
  return { removed: true, words: updated };
}

export function replaceBlacklistedWords(words: string[]): string[] {
  const filePath = resolveWordsFilePath();
  return writeWords(filePath, words);
}
