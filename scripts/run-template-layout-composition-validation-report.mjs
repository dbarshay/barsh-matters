#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { buildTemplateLayoutCompositionValidationReport } from "../src/lib/templates/layout-composition-validation-report.mjs";

function usage() {
  return [
    "Usage:",
    "  node scripts/run-template-layout-composition-validation-report.mjs --input <path> [--format markdown|json] [--output <path>]",
    "",
    "Input JSON shape:",
    "  { templates: [...], registry: {...}, exemptTemplateKinds?: [...], validationMode?: string }",
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = {
    format: "markdown",
    input: null,
    output: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") {
      parsed.input = argv[index + 1];
      index += 1;
    } else if (arg === "--format") {
      parsed.format = argv[index + 1];
      index += 1;
    } else if (arg === "--output") {
      parsed.output = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

export function runTemplateLayoutCompositionValidationReportCli(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const exit = io.exit || ((code) => process.exit(code));

  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    stderr.write(`${error.message}\n${usage()}\n`);
    return exit(2);
  }

  if (args.help) {
    stdout.write(`${usage()}\n`);
    return exit(0);
  }

  if (!args.input) {
    stderr.write(`Missing required --input path.\n${usage()}\n`);
    return exit(2);
  }

  if (!["markdown", "json"].includes(args.format)) {
    stderr.write(`Invalid --format value: ${args.format}\n${usage()}\n`);
    return exit(2);
  }

  const raw = readFileSync(args.input, "utf8");
  const input = JSON.parse(raw);
  const report = buildTemplateLayoutCompositionValidationReport(input);
  const rendered = args.format === "json" ? `${JSON.stringify(report, null, 2)}\n` : `${report.markdown}\n`;

  if (args.output) {
    writeFileSync(args.output, rendered, "utf8");
  } else {
    stdout.write(rendered);
  }

  return exit(report.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTemplateLayoutCompositionValidationReportCli(process.argv.slice(2));
}
