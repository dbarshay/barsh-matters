# Phase 43G — Replace Placeholder Direct UI Row Bridge

Phase 43G replaces the temporary inline `rows[0]` UI attachment bridge with a named guarded direct matter row resolver.

This keeps the Phase 43F surface attachment disabled/no-upload, but removes the placeholder inline row access from the JSX attachment.

Safety contract:

- the surface attachment uses `directMatterSingleMasterDryRunSurfaceRow()`;
- the resolver selects the first non-master direct matter row when available;
- the resolver falls back to the first row only when no better direct row exists;
- the control remains guarded off by default through `directMatterSingleMasterDryRunControlEnabled = false`;
- the control still forces `confirmUpload: false`;
- the control still forces `singleMasterDryRun: true`;
- the control still forces `singleMasterResolveFolders: true`;
- the bridge does not include `masterLawsuitId`;
- no live upload is enabled;
- no document is uploaded.
