#!/usr/bin/env bash
set -euo pipefail

DOC="docs/templates/templates-phase3-layout-composition-metadata-validator-design.md"

fail() {
  printf '\033[1;31mFAIL:\033[0m %s\n' "$1" >&2
  exit 1
}

pass() {
  printf '\033[1;32mPASS:\033[0m %s\n' "$1"
}

[[ -f "$DOC" ]] || fail "missing Phase 3 design doc"

grep -Fq "Templates Phase 3 — Layout Composition Metadata Validator Design" "$DOC" || fail "missing title"
grep -Fq "Design-only lock" "$DOC" || fail "missing design-only lock"
grep -Fq 'simpleCoverFaxPage' "$DOC" || fail "missing canonical simpleCoverFaxPage role"
grep -Fq "simple cover/fax page" "$DOC" || fail "missing user-facing simple cover/fax page terminology"
grep -Fq 'letterhead' "$DOC" || fail "missing letterhead role"
grep -Fq 'pleadingPaper' "$DOC" || fail "missing pleadingPaper role"
grep -Fq "letterhead plus pleading paper" "$DOC" || fail "missing composable letterhead plus pleading paper combination"
grep -Fq "letterhead plus pleading paper plus simple cover/fax page" "$DOC" || fail "missing three-asset composition"
grep -Fq "Shape validation" "$DOC" || fail "missing shape validation level"
grep -Fq "Registry validation" "$DOC" || fail "missing registry validation level"
grep -Fq "Dependency validation" "$DOC" || fail "missing dependency validation level"
grep -Fq "Rejected aliases" "$DOC" || fail "missing rejected aliases section"
grep -Fq 'simpleCoverPage' "$DOC" || fail "missing obsolete simpleCoverPage alias rejection"
grep -Fq "missing signer fields" "$DOC" || fail "missing signer dependency blocking category"
grep -Fq "missing addressee fields" "$DOC" || fail "missing addressee dependency blocking category"
grep -Fq "missing Re: fields" "$DOC" || fail "missing Re dependency blocking category"
grep -Fq "missing court/caption fields" "$DOC" || fail "missing pleading dependency blocking category"
grep -Fq "missing fax-cover fields" "$DOC" || fail "missing fax-cover dependency blocking category"
grep -Fq "pure function first" "$DOC" || fail "missing implementation guardrail"

if rg -n "simple cover page" "$DOC" | grep -v "obsolete phrase" >/dev/null; then
  fail "unqualified obsolete phrase simple cover page found"
fi

pass "Templates Phase 3 validator design doc contains locked terminology, validation levels, dependency categories, and implementation guardrails"
