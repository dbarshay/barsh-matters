from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
import html
import json
import re
import sys

fixture_path = Path("test/fixtures/templates/templates-phase18i-initial-billing-letter-manual-word-canonical-token-reinsertion-fixture.json")
fixture = json.loads(fixture_path.read_text())
docx = Path(fixture["sourceDocx"])

if not docx.exists():
    print("FAIL: DOCX missing: " + str(docx))
    sys.exit(1)

bad_xml = []
raw_xml_parts = []
visible_nodes = []
text_node_patterns = [
    re.compile(r"<w:t[^>]*>(.*?)</w:t>"),
    re.compile(r"<a:t[^>]*>(.*?)</a:t>"),
]

try:
    with ZipFile(docx, "r") as z:
        names = z.namelist()
        required_parts = {"[Content_Types].xml", "_rels/.rels", "word/document.xml"}
        missing_parts = sorted(required_parts.difference(names))
        if missing_parts:
            print("FAIL: DOCX missing required package parts: " + ", ".join(missing_parts))
            sys.exit(1)

        for name in names:
            if name.endswith(".xml"):
                data = z.read(name)
                try:
                    ET.fromstring(data)
                except Exception as exc:
                    bad_xml.append({"part": name, "error": str(exc)})
                xml = data.decode("utf-8", errors="replace")
                raw_xml_parts.append(xml)
                for pattern in text_node_patterns:
                    for match in pattern.finditer(xml):
                        visible_nodes.append(html.unescape(match.group(1)))
except Exception as exc:
    print("FAIL: DOCX package read failed: " + str(exc))
    sys.exit(1)

visible_text = "".join(visible_nodes)
raw_xml = "\n".join(raw_xml_parts)

required_tokens = fixture["requiredVisibleCanonicalTokens"]
missing_visible = [token for token in required_tokens if token not in visible_text]
split_raw_tokens = [token for token in required_tokens if token in visible_text and token not in raw_xml]
missing_phrases = [phrase for phrase in fixture["requiredVisiblePhrases"] if phrase not in visible_text]

legacy_visible = []
idx = 0
while True:
    a = visible_text.find("<<", idx)
    if a < 0:
        break
    b = visible_text.find(">>", a + 2)
    if b < 0:
        break
    legacy_visible.append(visible_text[a:b + 2])
    idx = b + 2

result = {
    "phase": fixture["phase"],
    "sourceDocx": str(docx),
    "sourceSizeBytes": docx.stat().st_size,
    "badXmlParts": bad_xml,
    "missingVisibleCanonicalTokens": missing_visible,
    "canonicalTokensPresentButSplitInRawXml": split_raw_tokens,
    "visibleLegacyChevronTokens": sorted(set(legacy_visible)),
    "missingRequiredVisiblePhrases": missing_phrases,
    "visibleTextPreview": visible_text[:1600],
    "generationWired": fixture["generationWired"],
    "clioCallsAllowed": fixture["clioCallsAllowed"],
    "storageCallsAllowed": fixture["storageCallsAllowed"],
}
print(json.dumps(result, indent=2))

if bad_xml:
    print("FAIL: XML parse errors")
    sys.exit(1)
if missing_visible:
    print("FAIL: missing visible canonical tokens: " + ", ".join(missing_visible))
    sys.exit(1)
if legacy_visible:
    print("FAIL: visible legacy tokens remain: " + ", ".join(sorted(set(legacy_visible))))
    sys.exit(1)
if missing_phrases:
    print("FAIL: missing required visible phrases: " + ", ".join(missing_phrases))
    sys.exit(1)

print("PASS: Phase 18I manually edited Word DOCX contains all visible canonical tokens and no visible legacy tokens")
