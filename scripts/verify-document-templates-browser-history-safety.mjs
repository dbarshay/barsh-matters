#!/usr/bin/env node

import fs from "node:fs";

const pagePath = "app/admin/document-templates/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function mustContain(label, needle) {
  if (!page.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, needle) {
  if (page.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("has visibility filter type", "type TemplateVisibilityFilter =");
mustContain("has URL state type", "type DocumentTemplateUrlState = {");
mustContain("normalizes category", "function normalizeTemplateCategory(value: unknown): TemplateCategory");
mustContain("normalizes visibility", "function normalizeTemplateVisibility(value: unknown): TemplateVisibilityFilter");
mustContain("reads state from URL", "function documentTemplateStateFromUrl(): DocumentTemplateUrlState");
mustContain("reads category param", "category: normalizeTemplateCategory(params.get(\"category\"))");
mustContain("reads visibility param", "visibility: normalizeTemplateVisibility(params.get(\"visibility\"))");
mustContain("builds URL state", "function documentTemplateUrlForState(state: DocumentTemplateUrlState)");
mustContain("pushes history", "window.history.pushState({ barshMattersDocumentTemplates: true }, \"\", nextUrl);");
mustContain("wrapped category setter", "function setCategory(categoryValue: TemplateCategory");
mustContain("wrapped visibility setter", "function setMergeFieldVisibilityFilter(value: TemplateVisibilityFilter");
mustContain("listens for popstate", 'window.addEventListener("popstate", applyDocumentTemplateStateFromUrl);');
mustContain("removes popstate listener", 'window.removeEventListener("popstate", applyDocumentTemplateStateFromUrl);');
mustContain("Back reloads templates by URL category", "void loadTemplates(urlState.category);");
mustContain("state initializes category from URL", "useState<TemplateCategory>(initialTemplateUrlState.category)");
mustContain("state initializes visibility from URL", "useState<TemplateVisibilityFilter>(initialTemplateUrlState.visibility)");

mustNotContain("old category state setter should not remain", 'const [category, setCategory] = useState<TemplateCategory>("settlement");');
mustNotContain("old category effect should not remain", "}, [category]);");

console.log("RESULT: verify Document Templates browser history safety");
console.log("PAGE=" + pagePath);
console.log("EXPECTS_DOCUMENT_TEMPLATE_CATEGORY_STATE_IN_URL=YES");
console.log("EXPECTS_BROWSER_BACK_RESTORES_TEMPLATE_CATEGORY_AND_VISIBILITY=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
