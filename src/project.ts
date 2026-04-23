import { existsSync, statSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const MARKERS = [
  '.git', '.hg', '.svn',
  'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml',
  'README.md', '.gitignore', 'CHANGELOG.md',
];

const CSPROJ_RE = /\.csproj$/i;

function hasMarker(dir: string): boolean {
  for (const m of MARKERS) {
    if (existsSync(path.join(dir, m))) return true;
  }
  try {
    const entries = readdirSync(dir);
    for (const e of entries) {
      if (CSPROJ_RE.test(e)) return true;
    }
  } catch {
    // ignore — directory unreadable, treat as "no marker"
  }
  return false;
}

const cache = new Map<string, { root: string; name: string }>();

export function resolveProjectRoot(cwd: string): { root: string; name: string } {
  const normalized = path.resolve(cwd);
  const cached = cache.get(normalized);
  if (cached) return cached;

  const home = path.resolve(homedir());
  const parsed = path.parse(normalized);
  const driveRoot = parsed.root;

  let current = normalized;
  let found = false;
  while (true) {
    // Hard boundaries — never walk past home or drive root
    if (current === home || current === driveRoot) break;

    try {
      if (statSync(current).isDirectory() && hasMarker(current)) {
        found = true;
        break;
      }
    } catch {
      break;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  const root = found ? current : normalized;
  const result = { root, name: path.basename(root) || root };
  cache.set(normalized, result);
  return result;
}

