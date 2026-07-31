#!/usr/bin/env node
/**
 * scripts/check-exports.mjs
 * Static analyzer for ESM import/export mismatches.
 * Uses @babel/parser and fast-glob (devDependencies in package.json).
 */
import fs from 'fs/promises';
import path from 'path';
import fg from 'fast-glob';
import { parse } from '@babel/parser';

const ROOT = process.cwd();

function parseModule(source, file) {
  try {
    return parse(source, {
      sourceType: 'module',
      plugins: ['classProperties', 'dynamicImport', 'importMeta', 'topLevelAwait'],
    });
  } catch (e) {
    return { parseError: `${e.message} (${file})` };
  }
}

function collectExports(ast) {
  const exports = new Set();
  let hasDefault = false;
  let hasExportAll = false;

  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        const decl = node.declaration;
        if (decl.id && decl.id.name) exports.add(decl.id.name);
        else if (decl.declarations) {
          for (const d of decl.declarations) {
            if (d.id && d.id.name) exports.add(d.id.name);
          }
        }
      }
      if (node.specifiers && node.specifiers.length) {
        for (const s of node.specifiers) {
          if (s.exported && s.exported.name) exports.add(s.exported.name);
        }
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      hasDefault = true;
    } else if (node.type === 'ExportAllDeclaration') {
      hasExportAll = true;
    }
  }

  return { exports, hasDefault, hasExportAll };
}

function collectImports(ast) {
  const imports = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const source = node.source.value;
      const specifiers = node.specifiers.map(s => {
        if (s.type === 'ImportDefaultSpecifier') return { type: 'default', importedName: 'default', localName: s.local.name };
        if (s.type === 'ImportNamespaceSpecifier') return { type: 'namespace', importedName: '*', localName: s.local.name };
        if (s.type === 'ImportSpecifier') return { type: 'named', importedName: s.imported.name, localName: s.local.name };
        return null;
      }).filter(Boolean);
      imports.push({ source, specifiers });
    }
  }
  return imports;
}

async function resolveCandidates(importSource, basedir) {
  if (!importSource.startsWith('.')) return [];
  const full = path.resolve(basedir, importSource);
  const candidates = [full, `${full}.js`, `${full}.mjs`, path.join(full, 'index.js'), path.join(full, 'index.mjs')];
  const exists = [];
  for (const c of candidates) {
    try {
      const s = await fs.stat(c);
      if (s.isFile()) exists.push(c);
    } catch (e) {}
  }
  return exists;
}

(async function main() {
  console.log('Scanning project for .js/.mjs files...');
  const entries = await fg(['**/*.js', '**/*.mjs'], { ignore: ['**/node_modules/**', '**/.git/**'] });
  const fileMap = new Map();

  for (const rel of entries) {
    const abs = path.resolve(ROOT, rel);
    const content = await fs.readFile(abs, 'utf8');
    const ast = parseModule(content, rel);
    if (ast.parseError) {
      fileMap.set(abs, { parseError: ast.parseError });
      continue;
    }
    const ex = collectExports(ast);
    const im = collectImports(ast);
    fileMap.set(abs, { ast, exports: ex.exports, hasDefault: ex.hasDefault, hasExportAll: ex.hasExportAll, imports: im });
  }

  const problems = [];
  for (const [file, meta] of fileMap.entries()) {
    if (meta.parseError) continue;
    const basedir = path.dirname(file);
    for (const imp of meta.imports) {
      if (!imp.source.startsWith('.')) continue;
      const resolved = await resolveCandidates(imp.source, basedir);
      if (!resolved.length) {
        problems.push({ type: 'missing-module', file, importSource: imp.source });
        continue;
      }
      const target = resolved[0];
      let tmeta = fileMap.get(target);
      if (!tmeta) {
        const content = await fs.readFile(target, 'utf8');
        const ast = parseModule(content, path.relative(ROOT, target));
        if (ast.parseError) { problems.push({ type: 'parse-error-target', file: target, message: ast.parseError }); continue; }
        const ex = collectExports(ast);
        tmeta = { exports: ex.exports, hasDefault: ex.hasDefault, hasExportAll: ex.hasExportAll };
        fileMap.set(target, tmeta);
      }
      for (const spec of imp.specifiers) {
        if (spec.type === 'default') {
          if (!tmeta.hasDefault && !tmeta.hasExportAll) {
            problems.push({ type: 'no-default', file, importSource: imp.source, imported: 'default', target });
          }
        } else if (spec.type === 'named') {
          if (!tmeta.exports.has(spec.importedName) && !tmeta.hasExportAll) {
            problems.push({ type: 'no-named', file, importSource: imp.source, imported: spec.importedName, target });
          }
        }
      }
    }
  }

  if (!problems.length) {
    console.log('No import/export mismatches detected (static analysis).');
    process.exit(0);
  }

  console.error('Import/Export mismatches found:');
  for (const p of problems) {
    if (p.type === 'missing-module') console.error(`- [MISSING MODULE] ${p.file} imports "${p.importSource}" -> NOT FOUND`);
    else if (p.type === 'no-default') console.error(`- [NO DEFAULT EXPORT] ${p.file} imports default from ${p.importSource} -> ${p.target} has no default export.`);
    else if (p.type === 'no-named') console.error(`- [NO NAMED EXPORT] ${p.file} imports { ${p.imported} } from ${p.importSource} -> ${p.target} does not export that name.`);
    else if (p.type === 'parse-error-target') console.error(`- [PARSE ERROR] ${p.file} -> ${p.message}`);
  }
  process.exit(2);
})();
