import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { resolveProjectRoot } from './project.js';

function makeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'tbq-proj-'));
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
    mkdir: (rel: string) => {
      mkdirSync(path.join(root, rel), { recursive: true });
      return path.join(root, rel);
    },
    touch: (rel: string) => {
      writeFileSync(path.join(root, rel), '');
    },
  };
}

describe('resolveProjectRoot', () => {
  test('returns cwd itself when no markers exist anywhere', () => {
    const fx = makeFixture();
    try {
      const dir = fx.mkdir('a/b/c');
      const res = resolveProjectRoot(dir);
      assert.equal(res.root, dir);
      assert.equal(res.name, 'c');
    } finally { fx.cleanup(); }
  });

  test('walks up to directory with .git', () => {
    const fx = makeFixture();
    try {
      const deep = fx.mkdir('myproj/src/nested');
      fx.mkdir('myproj/.git');
      const res = resolveProjectRoot(deep);
      assert.equal(res.root, path.join(fx.root, 'myproj'));
      assert.equal(res.name, 'myproj');
    } finally { fx.cleanup(); }
  });

  test('walks up to directory with package.json (no git)', () => {
    const fx = makeFixture();
    try {
      const deep = fx.mkdir('myproj/lib/x');
      fx.touch('myproj/package.json');
      const res = resolveProjectRoot(deep);
      assert.equal(res.name, 'myproj');
    } finally { fx.cleanup(); }
  });

  test('any marker works — README.md counts', () => {
    const fx = makeFixture();
    try {
      const deep = fx.mkdir('myproj/sub');
      fx.touch('myproj/README.md');
      const res = resolveProjectRoot(deep);
      assert.equal(res.name, 'myproj');
    } finally { fx.cleanup(); }
  });

  test('first marker wins — stops at nearest ancestor with any marker', () => {
    const fx = makeFixture();
    try {
      const deep = fx.mkdir('outer/inner/sub');
      fx.mkdir('outer/.git');
      fx.touch('outer/inner/package.json');
      const res = resolveProjectRoot(deep);
      assert.equal(res.name, 'inner');
    } finally { fx.cleanup(); }
  });

  test('stops at $HOME boundary', () => {
    const home = homedir();
    const res = resolveProjectRoot(home);
    assert.equal(res.root, home);
    assert.equal(res.name, path.basename(home));
  });

  test('returns the same result when called twice with same cwd (cached)', () => {
    const fx = makeFixture();
    try {
      const deep = fx.mkdir('p/q');
      fx.touch('p/README.md');
      const a = resolveProjectRoot(deep);
      const b = resolveProjectRoot(deep);
      assert.equal(a.root, b.root);
      assert.equal(a.name, b.name);
    } finally { fx.cleanup(); }
  });
});
