# Templates Phase 18B - Initial Billing Letter DOCX Import Gate

This phase imports only the locally placed Initial Billing Letter DOCX into the repository as a committed template asset.

Committed DOCX path: `templates/docx/letters/initial-billing-letter.docx`.

The template remains for individual Barsh Matters only. The named later dry-run test matter is `BRL_202600003`.

Generation remains unwired. Clio and storage calls remain prohibited.

The import gate uses normalized visible Word text, not raw XML-only token checks, because Word can split visible tokens across runs.

Legacy chevron tokens are allowed in this phase only as the verified source-template token inventory. A later transform/generation phase must ensure no legacy tokens remain in generated output.

Verified legacy token inventory:
- <<BALANCE_AMOUNT>>
- <<CASE_ID>>
- <<DOS_END>>
- <<DOS_START>>
- <<INJUREDPARTY_NAME>>
- <<INSURANCECOMPANY_LOCAL_CITY>>
- <<INSURANCECOMPANY_LOCAL_STATE>>
- <<INSURANCECOMPANY_LOCAL_ZIP>>
- <<INS_CLAIM_NUMBER>>
- <<NOWDT>>
- <<PROVIDER_SUITNAME>>

Required standard merge-code surface from Phase 18A:
- letter.date
- insurer.name
- insurer.mailingAddress
- provider.name
- patient.name
- claim.number
- claim.amount
- claim.dosRange
- matter.fileNumber

Required visible Word phrases:
- Barshay, Rizzo & Lopez
- Provider:
- Patient:
- Claim No.:
- Amount:
- Date of Service:
- Our File Number:
- Dear Sir or Madam

DOCX XML part count: 1
Normalized visible text characters: 2442
DOCX SHA-256: `ebab9d0c1dfa15526f620d18810b06f51b92d8ab0389c5885a86a43a2ded4580`
