# Template Builder Phase 6D — Multiline Address Block Rendering

This targeted repair fixes Build Template Example Output rendering for multiline address blocks.

The address block values are resolved and displayed as:

```text
Street
City, State Zip
```

The Example Output span now uses `whiteSpace: "pre-line"` so embedded newlines render visually in the merge-field table instead of collapsing into a single line.
