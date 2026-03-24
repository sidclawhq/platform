/**
 * Post-build script: fix dangling `./types` and `./enums` imports in .d.ts files.
 *
 * When tsup's `dts.resolve` inlines `@sidclaw/shared`, rollup-plugin-dts resolves
 * the barrel re-exports (e.g. `export * from './types'`) into direct submodule
 * references (`import { Foo } from './types'`) that don't exist in the output.
 *
 * This script replaces those dangling imports with the actual inlined type
 * declarations so external consumers don't need `@sidclaw/shared` at all.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname;

// The types that the SDK uses from @sidclaw/shared, fully inlined.
// These MUST stay in sync with packages/shared/src if those types ever change.
const INLINED_TYPES = `
type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';
type PolicyEffect = 'allow' | 'approval_required' | 'deny';
type ApprovalStatusExtended = 'pending' | 'approved' | 'denied' | 'expired';
interface EvaluateRequest {
    operation: string;
    target_integration: string;
    resource_scope: string;
    data_classification: DataClassification;
    context?: Record<string, unknown>;
}
interface EvaluateResponse {
    decision: PolicyEffect;
    trace_id: string;
    approval_request_id: string | null;
    reason: string;
    policy_rule_id: string | null;
}
`.trim();

/**
 * Recursively find all .d.ts and .d.cts files in a directory.
 */
function findDtsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findDtsFiles(fullPath));
    } else if (/\.d\.(c?ts)$/.test(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

let filesFixed = 0;

for (const file of findDtsFiles(DIST)) {
  let content = readFileSync(file, 'utf8');
  const original = content;

  // Replace `import { ... } from './types';` with nothing (we'll prepend the types)
  // Replace `import './types';` with nothing
  // Replace `export { ... } from './types';` by converting to local re-export
  // Also handle './enums', './schemas', './test-utils/factories'
  const danglingModules = ['./types', './enums', './schemas', './test-utils/factories'];

  let needsInlinedTypes = false;

  for (const mod of danglingModules) {
    const escapedMod = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match: import { Foo, Bar } from './types';
    const importNamedRe = new RegExp(`^import\\s*\\{[^}]*\\}\\s*from\\s*['"]${escapedMod}['"]\\s*;?\\s*$`, 'gm');
    if (importNamedRe.test(content)) {
      needsInlinedTypes = true;
      content = content.replace(importNamedRe, '');
    }

    // Match: import './types';
    const importBareRe = new RegExp(`^import\\s*['"]${escapedMod}['"]\\s*;?\\s*$`, 'gm');
    content = content.replace(importBareRe, '');

    // Match: export { Foo, Bar } from './types';
    // Convert to: export { Foo, Bar }; (local re-export, since types are now inlined)
    const exportNamedRe = new RegExp(`^(export\\s*\\{[^}]*\\})\\s*from\\s*['"]${escapedMod}['"]\\s*;?`, 'gm');
    if (exportNamedRe.test(content)) {
      needsInlinedTypes = true;
      content = content.replace(exportNamedRe, '$1;');
    }
  }

  if (needsInlinedTypes) {
    // Prepend the inlined type declarations
    content = INLINED_TYPES + '\n\n' + content;
  }

  // Clean up any resulting double blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  if (content !== original) {
    writeFileSync(file, content, 'utf8');
    filesFixed++;
    console.log(`  Fixed: ${file.replace(DIST, 'dist')}`);
  }
}

console.log(`Fixed ${filesFixed} .d.ts file(s).`);
