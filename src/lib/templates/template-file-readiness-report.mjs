export function listTemplateRecords(registry) {
  if (registry == null || typeof registry !== 'object') return [];
  if (Array.isArray(registry.templates)) return registry.templates;
  if (Array.isArray(registry.templateRecords)) return registry.templateRecords;
  if (registry.templatesById && typeof registry.templatesById === 'object') return Object.values(registry.templatesById);
  return [];
}

export function getTemplateRecordId(template) {
  if (template == null || typeof template !== 'object') return null;
  return template.id || template.templateId || template.key || template.slug || null;
}

export function buildTemplateFileReadinessReport(registry, options = {}) {
  const approvedTemplatePathPrefixes = Array.isArray(options.approvedTemplatePathPrefixes) ? options.approvedTemplatePathPrefixes : [];
  const physicalFileExists = typeof options.physicalFileExists === 'function' ? options.physicalFileExists : () => false;
  const templates = listTemplateRecords(registry);
  const records = templates.map((template) => {
    const id = getTemplateRecordId(template);
    const templateFile = template && typeof template === 'object' ? template.templateFile : null;
    const path = templateFile && typeof templateFile.path === 'string' ? templateFile.path : null;
    const kind = templateFile && typeof templateFile.kind === 'string' ? templateFile.kind : null;
    const required = templateFile && typeof templateFile.required === 'boolean' ? templateFile.required : false;
    const approvedPath = typeof path === 'string' && approvedTemplatePathPrefixes.some((prefix) => path.startsWith(prefix));
    const exists = typeof path === 'string' ? Boolean(physicalFileExists(path, template)) : false;
    const status = exists ? 'available' : 'missing';
    const blocking = required && exists === false;
    return {
      id,
      kind,
      path,
      required,
      approvedPath,
      exists,
      status,
      blocking,
    };
  });
  const available = records.filter((record) => record.exists);
  const missing = records.filter((record) => record.exists === false);
  const requiredMissing = records.filter((record) => record.required && record.exists === false);
  const unapprovedPaths = records.filter((record) => record.approvedPath === false);
  return {
    generatedAt: options.generatedAt || null,
    templateCount: records.length,
    availableCount: available.length,
    missingCount: missing.length,
    requiredMissingCount: requiredMissing.length,
    unapprovedPathCount: unapprovedPaths.length,
    generationReady: requiredMissing.length === 0 && unapprovedPaths.length === 0,
    records,
    missingPaths: missing.map((record) => record.path).filter(Boolean).sort(),
    requiredMissingPaths: requiredMissing.map((record) => record.path).filter(Boolean).sort(),
    unapprovedPaths: unapprovedPaths.map((record) => record.path).filter(Boolean).sort(),
  };
}
