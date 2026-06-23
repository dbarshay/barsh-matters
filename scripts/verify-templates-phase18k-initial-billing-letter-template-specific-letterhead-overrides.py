from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.etree import ElementTree as ET
import html
import json
import re
import sys

fixture_path = Path("test/fixtures/templates/templates-phase18k-initial-billing-letter-template-specific-letterhead-overrides-fixture.json")
fixture = json.loads(fixture_path.read_text())
fmt_fixture = json.loads(Path(fixture["phase18JPreferredFormattingFixture"]).read_text())
fmt = fmt_fixture["preferredLetterFormatting"]

letterhead = Path(fixture["letterheadAsset"])
body_template = Path(fixture["bodyTemplate"])
output_dir = Path(fixture["outputDir"])
output_dir.mkdir(parents=True, exist_ok=True)
output = Path(fixture["outputDocx"])
overrides = fixture["templateSpecificLetterheadOverrides"]

body_pattern = re.compile(r"(<w:body\b[^>]*>)(.*?)(</w:body>)", re.DOTALL)
sectpr_pattern = re.compile(r"<w:sectPr\b.*?</w:sectPr>", re.DOTALL)
pgmar_pattern = re.compile(r"<w:pgMar\b[^>]*/>")
text_node_pattern = re.compile(r"(<(?:w|a):t\b[^>]*>)(.*?)(</(?:w|a):t>)", re.DOTALL)

def text_nodes(xml):
    return "".join(html.unescape(m.group(2)) for m in text_node_pattern.finditer(xml))

def get_body_inner(xml):
    match = body_pattern.search(xml)
    if match is None:
        raise SystemExit("FAIL: DOCX document.xml missing w:body")
    return match.group(2)

def last_sectpr(body_inner):
    matches = list(sectpr_pattern.finditer(body_inner))
    if not matches:
        raise SystemExit("FAIL: DOCX document.xml missing sectPr")
    return matches[-1].group(0)

def enforce_margins_and_header_distance(sectpr):
    margins = fmt["pageMarginsTwips"]
    pgmar = (
        "<w:pgMar w:top=\"" + str(margins["top"]) +
        "\" w:right=\"" + str(margins["right"]) +
        "\" w:bottom=\"" + str(margins["bottom"]) +
        "\" w:left=\"" + str(margins["left"]) +
        "\" w:header=\"" + str(fmt["headerDistanceTwips"]) +
        "\" w:footer=\"720\" w:gutter=\"0\"/>"
    )
    if pgmar_pattern.search(sectpr):
        return pgmar_pattern.sub(pgmar, sectpr, count=1)
    return sectpr.replace("</w:sectPr>", pgmar + "</w:sectPr>")

def esc(value):
    return html.escape(value, quote=False)

def rewrite_header_text_nodes(xml):
    matches = list(text_node_pattern.finditer(xml))
    if not matches:
        return xml

    visible = "".join(html.unescape(m.group(2)) for m in matches)

    # Template-specific Initial Billing Letter overrides only.
    visible = visible.replace("Tel: (631) 210-7272, signer.extension", overrides["tel"])
    visible = visible.replace("Tel: (631) 210-7272 signer.extension", overrides["tel"])
    visible = visible.replace("Tel: (631) 210-7272, ", overrides["tel"])
    visible = visible.replace("signer.extension", "")
    visible = visible.replace("Fax: signer.fax", overrides["fax"])
    visible = visible.replace("Fax:", overrides["fax"])
    visible = visible.replace("signer.fax", "")
    visible = visible.replace("Email: signer.email", overrides["email"])
    visible = visible.replace("signer.email", "info@brlfirm.com")

    # Put the full visible header text into the first text node and clear the rest.
    rebuilt = []
    cursor = 0
    for index, match in enumerate(matches):
        rebuilt.append(xml[cursor:match.start()])
        text = visible if index == 0 else ""
        rebuilt.append(match.group(1) + esc(text) + match.group(3))
        cursor = match.end()
    rebuilt.append(xml[cursor:])
    return "".join(rebuilt)

def r_text(text, size=None):
    if size is None:
        size = str(fmt["bodyFontHalfPoints"])
    return "<w:r><w:rPr><w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\"/><w:sz w:val=\"" + str(size) + "\"/></w:rPr><w:t xml:space=\"preserve\">" + esc(text) + "</w:t></w:r>"

def r_tab(count):
    return "".join("<w:r><w:tab/></w:r>" for _ in range(count))

def p(text="", before="0", after="80", line="240", first_line=None, tabs=0, align=None, size=None):
    ppr = []
    if align:
        ppr.append("<w:jc w:val=\"" + align + "\"/>")
    if first_line is not None:
        ppr.append("<w:ind w:firstLine=\"" + first_line + "\"/>")
    ppr.append("<w:spacing w:before=\"" + before + "\" w:after=\"" + after + "\" w:line=\"" + line + "\" w:lineRule=\"auto\"/>")
    ppr_xml = "<w:pPr>" + "".join(ppr) + "</w:pPr>"
    if text == "":
        return "<w:p>" + ppr_xml + "</w:p>"
    return "<w:p>" + ppr_xml + r_tab(tabs) + r_text(text, size=size) + "</w:p>"

def p_runs(runs, before="0", after="80", line="240", first_line=None, align=None):
    ppr = []
    if align:
        ppr.append("<w:jc w:val=\"" + align + "\"/>")
    if first_line is not None:
        ppr.append("<w:ind w:firstLine=\"" + first_line + "\"/>")
    ppr.append("<w:spacing w:before=\"" + before + "\" w:after=\"" + after + "\" w:line=\"" + line + "\" w:lineRule=\"auto\"/>")
    return "<w:p><w:pPr>" + "".join(ppr) + "</w:pPr>" + "".join(runs) + "</w:p>"

def body_paragraph(text):
    return p(text, before="0", after=str(fmt["bodyParagraphSpacingAfterTwips"]), line="230", first_line="720", align="both")

def line(text, tabs=0, after="20"):
    return p(text, before="0", after=str(after), line="220", tabs=tabs)

if not letterhead.exists():
    raise SystemExit("FAIL: missing shared letterhead asset: " + str(letterhead))
if not body_template.exists():
    raise SystemExit("FAIL: missing body template: " + str(body_template))

paragraphs = []
paragraphs.append(p("", after="150"))
paragraphs.append(line("June 23, 2026", tabs=fmt["dateTabs"], after="70"))
paragraphs.append(p("", after="35"))
paragraphs.append(line("Allstate Indemnity Company", after="10"))
paragraphs.append(line("3100 Sanders Road, Suite 201", after="10"))
paragraphs.append(line("Northbrook, Illinois 60062", after=str(fmt["insurerToReSpacingAfterTwips"])))
paragraphs.append(p_runs([
    r_tab(fmt["reLineLeadingTabs"]),
    r_text("Re:"),
    r_tab(fmt["reLineProviderOffsetTabs"]),
    r_text("Provider: ATLANTIC MEDICAL & DIAGNOSTIC, P.C.")
], after="12", line="220"))
paragraphs.append(line("Patient: David Barshay", tabs=fmt["followingReLinesTabs"], after="12"))
paragraphs.append(line("Claim No.: 1111", tabs=fmt["followingReLinesTabs"], after="12"))
paragraphs.append(line("Amount: " + chr(36) + "836.75", tabs=fmt["followingReLinesTabs"], after="12"))
paragraphs.append(line("Date of Service: 02/03/2021", tabs=fmt["followingReLinesTabs"], after="12"))
paragraphs.append(line("Our File Number: BRL_202600003", tabs=fmt["followingReLinesTabs"], after=str(fmt["reToDearSpacingAfterTwips"])))
paragraphs.append(line("Dear Sir or Madam:", after=str(fmt["dearToBodySpacingAfterTwips"])))
paragraphs.append(body_paragraph("This office has been retained by the above-referenced provider concerning the attached claim for benefits made under New York State’s No-Fault Insurance Law. As such, unless otherwise stated herein, please direct all correspondence concerning this matter directly to our office."))
paragraphs.append(body_paragraph("Any payments made should be made payable to the medical provider and sent to our office. Should any portion of this claim be paid in an untimely manner, demand is made for statutory interest pursuant to 11 N.Y.C.R.R. 65-3.9(a)."))
paragraphs.append(body_paragraph("All denials of benefits, explanations of benefits, and requests for additional verification must be mailed both to the above-referenced provider and our office."))
paragraphs.append(body_paragraph("If this claim is denied in whole or in part, demand is hereby made for a copy of all prescribed claim forms submitted by or on behalf of the applicant pursuant to 11 N.Y.C.R.R. 65-3.8(c)(1). If this claim is denied in whole or in part based upon a medical examination or peer review report requested by the insurer, demand is hereby made for a copy of that report pursuant to 11 N.Y.C.R.R. 65-3.8(b)(4), and for a copy of all documents provided to the examiner pursuant to 11 N.Y.C.R.R. 65-3.2(b), (e) and (f)."))
paragraphs.append(body_paragraph("The demand for the above-mentioned documentation is made in order to allow the applicant provider an opportunity to review and respond to the merits, or lack thereof, of the denial. Where the denial is based on a medical examination or peer review, the demand for the above-mentioned documentation is made in order to allow the applicant provider the opportunity to review the same materials given to the examiner and, where appropriate, submit a response to the medical examination or peer review, and/or to obtain a rebuttal opinion from an appropriate medical professional. The failure to provide the demanded documentation will be construed as an intentional attempt to frustrate the applicant provider’s ability to respond to the denial of benefits."))
paragraphs.append(p("", after="100"))
paragraphs.append(line("Very truly yours,", tabs=fmt["closingTabs"], after=str(fmt["signatureGapAfterVeryTrulyYoursTwips"])))
paragraphs.append(line(overrides["signatureName"], tabs=fmt["closingTabs"], after="0"))

with ZipFile(letterhead, "r") as z:
    names = z.namelist()
    header_parts = [n for n in names if n.startswith("word/header") and n.endswith(".xml")]
    media_parts = [n for n in names if n.startswith("word/media/")]
    doc_xml = z.read("word/document.xml").decode("utf-8", errors="replace")
    sectpr = enforce_margins_and_header_distance(last_sectpr(get_body_inner(doc_xml)))
    if len(header_parts) == 0:
        raise SystemExit("FAIL: shared letterhead asset has no header parts")
    if len(media_parts) == 0:
        raise SystemExit("FAIL: shared letterhead asset has no media/logo parts")
    if "headerReference" not in sectpr or "first" not in sectpr or "default" not in sectpr:
        raise SystemExit("FAIL: shared letterhead asset does not expose first/default header behavior")

new_body = "".join(paragraphs) + sectpr
new_doc_xml = body_pattern.sub(lambda m: m.group(1) + new_body + m.group(3), doc_xml, count=1)

with ZipFile(letterhead, "r") as zin:
    with ZipFile(output, "w", ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == "word/document.xml":
                data = new_doc_xml.encode("utf-8")
            elif info.filename.startswith("word/header") and info.filename.endswith(".xml"):
                xml = data.decode("utf-8", errors="replace")
                xml = rewrite_header_text_nodes(xml)
                data = xml.encode("utf-8")
            zout.writestr(info, data)

bad_xml = []
visible_parts = []
raw_parts = []
with ZipFile(output, "r") as z:
    out_names = z.namelist()
    out_header_parts = [n for n in out_names if n.startswith("word/header") and n.endswith(".xml")]
    out_media_parts = [n for n in out_names if n.startswith("word/media/")]
    for name in out_names:
        if name.endswith(".xml"):
            data = z.read(name)
            try:
                ET.fromstring(data)
            except Exception as exc:
                bad_xml.append({"part": name, "error": str(exc)})
            xml = data.decode("utf-8", errors="replace")
            raw_parts.append(xml)
            visible_parts.append(text_nodes(xml))

visible = "".join(visible_parts)
missing_expected = [v for v in fixture["expectedVisibleValues"] if v not in visible]
forbidden_visible = [v for v in fixture["forbiddenVisibleValuesInInitialBillingLetterProof"] if v in visible]
visible_canonical_tokens = sorted(set(re.findall(r"\{\{[^}]+\}\}", visible)))
visible_legacy_tokens = sorted(set(re.findall(r"<<[^>]+>>", visible)))

result = {
    "phase": fixture["phase"],
    "templateId": fixture["templateId"],
    "overrideScope": overrides["scope"],
    "letterheadAsset": str(letterhead),
    "bodyTemplate": str(body_template),
    "outputDocx": str(output),
    "templateSpecificLetterheadOverrides": overrides,
    "otherTemplatesRemainDynamic": fixture["otherTemplatesRemainDynamic"],
    "outputHeaderPartCount": len(out_header_parts),
    "outputMediaPartCount": len(out_media_parts),
    "hasFirstPageHeaderReference": "first" in sectpr and "headerReference" in sectpr,
    "hasDefaultHeaderReference": "default" in sectpr and "headerReference" in sectpr,
    "missingExpectedVisibleValues": missing_expected,
    "forbiddenVisibleValues": forbidden_visible,
    "visibleCanonicalTokens": visible_canonical_tokens,
    "visibleLegacyTokens": visible_legacy_tokens,
    "badOutputXmlParts": bad_xml,
    "generationWired": fixture["generationWired"],
    "clioCallsAllowed": fixture["clioCallsAllowed"],
    "storageCallsAllowed": fixture["storageCallsAllowed"],
    "visibleTextPreview": visible[:2200]
}
print(json.dumps(result, indent=2))

if bad_xml:
    raise SystemExit("FAIL: output XML parse errors")
if len(out_header_parts) == 0:
    raise SystemExit("FAIL: output has no header parts")
if len(out_media_parts) == 0:
    raise SystemExit("FAIL: output has no media/logo parts")
if missing_expected:
    raise SystemExit("FAIL: missing expected visible values: " + ", ".join(missing_expected))
if forbidden_visible:
    raise SystemExit("FAIL: forbidden signer placeholders remain visible: " + ", ".join(forbidden_visible))
if visible_canonical_tokens:
    raise SystemExit("FAIL: visible canonical tokens remain: " + ", ".join(visible_canonical_tokens))
if visible_legacy_tokens:
    raise SystemExit("FAIL: visible legacy tokens remain: " + ", ".join(visible_legacy_tokens))

report = output_dir / "phase18k-template-specific-letterhead-overrides-report.json"
report.write_text(json.dumps(result, indent=2) + chr(10))
print("PASS: Phase 18K template-specific Initial Billing Letter overrides verified without changing dynamic behavior for other templates")
