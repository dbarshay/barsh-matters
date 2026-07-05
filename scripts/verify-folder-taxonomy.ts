// Verify the document folder taxonomy is well-formed (Phase 1 proof).
//
//   npx tsx scripts/verify-folder-taxonomy.ts
//
// Asserts structural invariants so a malformed tree can't ship: unique folder keys, terminal folders
// carry titles or freehand, unique title keys per folder, label templates only reference declared
// prompt fields, non-terminals have children (and vice-versa), and required-conditional prompts
// reference sibling fields. Exits non-zero on any violation.

import {
  FOLDER_TAXONOMY,
  listTerminalFolders,
  type FolderSpec,
} from "@/lib/documents/folderTaxonomy";

const errors: string[] = [];
const seenKeys = new Set<string>();
let folderCount = 0;
let terminalCount = 0;
let titleCount = 0;

function walk(folders: FolderSpec[]) {
  for (const f of folders) {
    folderCount++;
    if (seenKeys.has(f.key)) errors.push(`Duplicate folder key: ${f.key}`);
    seenKeys.add(f.key);

    if (!["matter", "lawsuit"].includes(f.level)) errors.push(`${f.key}: bad level "${f.level}"`);

    const hasChildren = !!(f.children && f.children.length);
    if (f.terminal && hasChildren) errors.push(`${f.key}: terminal folder has children`);
    if (!f.terminal && !hasChildren) errors.push(`${f.key}: non-terminal folder has no children`);

    if (f.terminal) {
      terminalCount++;
      if (f.titles.length === 0 && !f.allowFreehandOther) {
        errors.push(`${f.key}: terminal folder has no titles and no freehand`);
      }
      const titleKeys = new Set<string>();
      for (const t of f.titles) {
        titleCount++;
        if (titleKeys.has(t.key)) errors.push(`${f.key}: duplicate title key "${t.key}"`);
        titleKeys.add(t.key);

        const promptKeys = new Set((t.prompts ?? []).map((p) => p.key));
        // Label template tokens must be declared prompt fields.
        if (t.labelTemplate) {
          const tokens = [...t.labelTemplate.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
          for (const tok of tokens) {
            if (!promptKeys.has(tok)) {
              errors.push(`${f.key}/${t.key}: labelTemplate references undeclared field "{${tok}}"`);
            }
          }
        }
        // A static title should not also carry prompts.
        if (t.static && (t.prompts?.length || t.labelTemplate)) {
          errors.push(`${f.key}/${t.key}: static title must not have prompts/labelTemplate`);
        }
        // select prompts need options; showWhen must reference a sibling field.
        for (const p of t.prompts ?? []) {
          if (p.type === "select" && (!p.options || p.options.length === 0)) {
            errors.push(`${f.key}/${t.key}/${p.key}: select prompt has no options`);
          }
          if (p.showWhen && !promptKeys.has(p.showWhen.field)) {
            errors.push(`${f.key}/${t.key}/${p.key}: showWhen references unknown field "${p.showWhen.field}"`);
          }
        }
      }
    }

    if (f.children) walk(f.children);
  }
}

walk(FOLDER_TAXONOMY);

console.log(
  `Taxonomy: ${folderCount} folders, ${terminalCount} terminal, ${titleCount} titles across ` +
    `${FOLDER_TAXONOMY.length} branches.`,
);
console.log(`Terminal folders (${listTerminalFolders().length}):`);
for (const t of listTerminalFolders()) {
  const freehand = t.allowFreehandOther ? " +Other" : "";
  const dl = t.promptsDeadline ? " ⏰" : "";
  console.log(`   ${t.key.padEnd(38)} [${t.level}] ${t.titles.length} titles${freehand}${dl}`);
}

if (errors.length > 0) {
  console.error(`\n❌ ${errors.length} taxonomy error(s):`);
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`\n✅ Taxonomy valid.`);
