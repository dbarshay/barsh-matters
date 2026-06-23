#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys
import zipfile
from html import escape, unescape

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DOCX = ROOT / "templates" / "docx" / "letters" / "initial-billing-letter.docx"
OUTPUT_DIR = ROOT / ".tmp-phase18e-output"
OUTPUT_DOCX = OUTPUT_DIR / "initial-billing-letter-BRL_202600003-transform-preview.docx"
PROOF_JSON = OUTPUT_DIR / "initial-billing-letter-BRL_202600003-transform-preview-proof.json"

REPLACEMENTS = {
    "<<NOWDT>>": "June 23, 2026",
    "<<INSURANCECOMPANY>>": "Allstate Indemnity Company",
    "<<INSURANCECOMPANY_LOCAL_NAME>>": "Allstate Indemnity Company",
    "<<INSURANCECOMPANY_LOCAL_STREET>>": "3100 Sanders Road, Suite 201",
    "<<INSURANCECOMPANY_LOCAL_ADDRESS>>": "3100 Sanders Road, Suite 201",
    "<<INSURANCECOMPANY_LOCAL_CITY>>": "Northbrook",
    "<<INSURANCECOMPANY_LOCAL_STATE>>": "Illinois",
    "<<INSURANCECOMPANY_LOCAL_ZIP>>": "60062",
    "<<PROVIDER_SUITNAME>>": "ATLANTIC MEDICAL & DIAGNOSTIC, P.C.",
    "<<INJUREDPARTY_NAME>>": "David Barshay",
    "<<INS_CLAIM_NUMBER>>": "1111",
    "<<BALANCE_AMOUNT>>": "$836.75",
    "<<DOS_START>>": "02/03/2021",
    "<<DOS_END>>": "02/03/2021",
    "<<CASE_ID>>": "BRL_202600003",
}

EXPECTED_VISIBLE_VALUES = [
    "June 23, 2026",
    "Northbrook",
    "Illinois",
    "60062",
    "ATLANTIC MEDICAL & DIAGNOSTIC, P.C.",
    "David Barshay",
    "1111",
    "$836.75",
    "02/03/2021",
    "BRL_202600003",
]

EXPECTED_VALUES_NOT_PRESENT_IN_SOURCE_DOCX = [
    "Allstate Indemnity Company",
    "3100 Sanders Road, Suite 201",
]

VISIBLE_WORD_XML = re.compile(r"^word/(document|header[0-9]+|footer[0-9]+|footnotes|endnotes)\.xml$")

def fail(message, details=None):
    print("FAIL:", message)
    if details is not None:
        print(json.dumps(details, indent=2, sort_keys=True))
    sys.exit(1)

def normalize_text(value):
    return re.sub(r"\s+", " ", value).strip()

def extract_visible_text_from_xml(xml_text):
    chunks = []
    for match in re.finditer(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", xml_text, flags=re.DOTALL):
        chunks.append(unescape(match.group(1)))
    return normalize_text(" ".join(chunks))

def token_forms(token):
    return [
        token,
        escape(token),
        escape(token, quote=False),
    ]

def replace_token_forms(xml_text, token, value):
    count = 0
    for form in dict.fromkeys(token_forms(token)):
        form_count = xml_text.count(form)
        if form_count > 0:
            count += form_count
            xml_text = xml_text.replace(form, escape(value, quote=False))
    return xml_text, count

def read_visible_text(docx_path):
    parts = []
    with zipfile.ZipFile(docx_path, "r") as z:
        for name in z.namelist():
            if VISIBLE_WORD_XML.match(name):
                parts.append(extract_visible_text_from_xml(z.read(name).decode("utf-8")))
    return normalize_text(" ".join(parts))

def read_visible_tokens(docx_path):
    text = read_visible_text(docx_path)
    return sorted(set(re.findall(r"<<[^<>]+>>", text))), text

def transform_docx():
    if SOURCE_DOCX.exists() is False:
        fail("Source DOCX is missing", {"source": str(SOURCE_DOCX)})
    source_tokens, source_visible_text = read_visible_tokens(SOURCE_DOCX)
    if len(source_visible_text) == 0:
        fail("Source DOCX visible text could not be extracted", {"source": str(SOURCE_DOCX)})
    if len(source_tokens) == 0:
        fail("Source DOCX has no visible legacy chevron tokens to transform", {"sourceVisibleTextPreview": source_visible_text[:2500]})

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    replacement_counts = {token: 0 for token in REPLACEMENTS}
    with zipfile.ZipFile(SOURCE_DOCX, "r") as zin:
        names = zin.namelist()
        if "word/document.xml" not in names:
            fail("DOCX is missing word/document.xml")
        with zipfile.ZipFile(OUTPUT_DOCX, "w", compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename.startswith("word/") and item.filename.endswith(".xml"):
                    xml_text = data.decode("utf-8")
                    for token, value in REPLACEMENTS.items():
                        xml_text, count = replace_token_forms(xml_text, token, value)
                        replacement_counts[token] += count
                    data = xml_text.encode("utf-8")
                zout.writestr(item, data)

    visible_text = read_visible_text(OUTPUT_DOCX)
    legacy_tokens = sorted(set(re.findall(r"<<[^<>]+>>", visible_text)))
    missing_values = [value for value in EXPECTED_VISIBLE_VALUES if value not in visible_text]
    unreplaced_source_tokens = [token for token in source_tokens if token in REPLACEMENTS and replacement_counts.get(token, 0) == 0]
    unmapped_source_tokens = [token for token in source_tokens if token not in REPLACEMENTS]

    proof = {
        "phase": "Templates Phase 18E",
        "matterFileNumber": "BRL_202600003",
        "sourceDocx": str(SOURCE_DOCX.relative_to(ROOT)),
        "outputDocx": str(OUTPUT_DOCX.relative_to(ROOT)),
        "sourceVisibleTokens": source_tokens,
        "replacementCounts": replacement_counts,
        "unmappedSourceTokens": unmapped_source_tokens,
        "unreplacedSourceTokens": unreplaced_source_tokens,
        "legacyTokensRemainingInVisibleText": legacy_tokens,
        "missingExpectedVisibleValues": missing_values,
        "expectedValuesNotPresentBecauseSourceDocxHasNoCorrespondingVisibleToken": EXPECTED_VALUES_NOT_PRESENT_IN_SOURCE_DOCX,
        "sourceVisibleTextPreview": source_visible_text[:2500],
        "transformedVisibleTextPreview": visible_text[:2500],
    }
    PROOF_JSON.write_text(json.dumps(proof, indent=2, sort_keys=True) + "\n")
    if unmapped_source_tokens:
        fail("Source DOCX contains visible legacy tokens not covered by Phase 18E mapping", proof)
    if unreplaced_source_tokens:
        fail("Some mapped source tokens were not replaced", proof)
    if legacy_tokens:
        fail("Legacy chevron tokens remain in transformed DOCX visible text", proof)
    if missing_values:
        fail("Expected values are missing from transformed DOCX visible text", proof)

    print("PASS: Phase 18E transformed DOCX visible text has no legacy chevron tokens")
    print("PASS: Phase 18E expected BRL_202600003 values are present")
    print("OUTPUT_DOCX=" + str(OUTPUT_DOCX.relative_to(ROOT)))
    print("PROOF_JSON=" + str(PROOF_JSON.relative_to(ROOT)))
    print(json.dumps(proof, indent=2, sort_keys=True))

if __name__ == "__main__":
    transform_docx()
