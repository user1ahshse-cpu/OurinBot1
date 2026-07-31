#!/usr/bin/env node
/**
 * scripts/check-syntax.mjs
 * Cross-platform syntax checker that runs `node --check` on all .js/.mjs files
 * excluding node_modules and .git directories.
 */
import fs from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';

const root = process.cwd();
const exts = new Set(['.js', '.mjs']);
const ignoreDirs = new Set(['node_modules', '.git']);

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const name = e.name;
    if (ignoreDirs.has(name)) continue;
    const full = path.join(dir, name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile() && exts.has(path.extname(name))) yield full;
  }
}

(async function main() {
  const files = [];
  for await (const f of walk(root)) files.push(f);
  if (files.length === 0) {
    console.log('No JS files found to check.');
    process.exit(0);
  }

  console.log(`Checking syntax for ${files.length} files...`);
  let hadError = false;
  for (const file of files) {
    // skip files in workflow runner that might be generated
    if (file.includes(path.join('node_modules')) || file.includes(path.join('.git'))) continue;
    const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (res.status !== 0) {
      hadError = true;
      console.error(`\nSyntax error in: ${path.relative(root, file)}`);
      if (res.stderr) console.error(res.stderr);
      else if (res.stdout) console.error(res.stdout);
    }
  }

  if (hadError) {
    console.error('\nSyntax check failed.');
    process.exit(2);
  }
  console.log('Syntax check passed.');
  process.exit(0);
})();
