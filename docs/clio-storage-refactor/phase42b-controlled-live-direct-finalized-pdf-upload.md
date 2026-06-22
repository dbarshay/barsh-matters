# Phase 42B — Macro Controlled Live Direct Finalized PDF Upload

Phase 42B performs the first controlled live direct/individual finalized PDF upload through the single-master Clio storage path.

The smoke uses existing direct matter id `1881278195` for the real local ClaimIndex row and preserves `BRL_202600001` as the Barsh Matters direct matter storage target. The expected Clio upload parent folder is the existing direct matter folder id `22062401000`.

This phase intentionally creates a Graph working DOCX, converts that working DOCX to a finalized PDF, uploads exactly one finalized PDF to the resolved single-master Clio folder, and records the local finalization audit metadata.

Safety contract:

- upload target kind must be `individual_matter`;
- direct matter file number must be `BRL_202600001`;
- upload must be rewired to the existing Clio folder id `22062401000`;
- no new Clio folder branch should be created;
- no patient/provider/insurer/claim/denial facts may drive Clio folder names;
- the upload result must identify parent type `Folder`;
- the upload result must report `fullyUploaded: true`;
- production environment variables are not changed.

## Locked live upload proof

The Phase 42B live smoke completed the controlled upload before the assertion repair. The response proved:

- `FINALIZE_STATUS=200`;
- `uploadRewired=true`;
- exactly one finalized PDF uploaded;
- upload parent type `Folder`;
- upload parent id `22062401000`;
- `createdFolderCount=0`;
- `reusedFolderCount=3`;
- `fullyUploaded=true`;
- Clio document id `22070801495`;
- finalization audit record id `104`.

The post-live repair only corrected the smoke assertion/redaction and did not rerun the live upload.
