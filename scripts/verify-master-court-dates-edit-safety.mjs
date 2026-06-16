import fs from "node:fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const route = fs.readFileSync("app/api/court-calendar/events/route.ts", "utf8");
const failures = [];

function mustContain(haystack, token, message) {
  if (!haystack.includes(token)) failures.push(message);
}

function mustNotContain(haystack, token, message) {
  if (haystack.includes(token)) failures.push(message);
}

mustContain(page, 'data-barsh-master-edit-court-dates-button="true"', "missing real Edit Court Dates button marker");
mustContain(page, ">Edit Court Dates</button>", "button label must be Edit Court Dates");
mustNotContain(page, "View / Edit Court Dates", "obsolete view/edit label remains in page");
mustNotContain(page, "data-barsh-master-view-edit-court-dates-placeholder", "placeholder edit marker remains in page");
mustNotContain(page, "View / Edit Court Dates will be wired", "placeholder alert remains in page");

mustContain(page, "masterEditCourtDatesSelectedEvent", "edit popup must store selected Court Date object");
mustContain(page, "setMasterEditCourtDatesSelectedEvent(courtEvent)", "chooser must store selected Court Date object");
mustContain(page, "if (masterEditCourtDatesSelectedEvent) return masterEditCourtDatesSelectedEvent;", "selected helper must prefer selected Court Date object");
mustContain(page, "const selectedEvent = courtEvent || masterEditCourtDatesSelectedEvent || selectedMasterEditCourtDate();", "save handler must use selected Court Date object as source of truth");

mustContain(page, "function openMasterEditCourtDatesDialog()", "missing edit dialog open handler");
mustContain(page, "function updateMasterEditCourtDateForm", "missing edit form update helper");
mustContain(page, "function saveMasterCourtDateEdit", "missing save edit handler");
mustContain(page, 'data-barsh-master-edit-court-dates-popup="true"', "missing edit popup marker");
mustContain(page, 'data-barsh-master-edit-court-date-row="true"', "missing edit row marker");
mustContain(page, 'data-barsh-master-edit-court-date-save-button="true"', "missing edit save button marker");
mustContain(page, 'method: "PATCH"', "edit save must call PATCH");

mustContain(page, "function masterCourtDateEventKey", "edit popup must use a stable event key");
mustContain(page, "const idKey = rawId === null || rawId === undefined ? \"\" : String(rawId).trim();", "event key helper must preserve numeric ids when present");
mustContain(page, "if (idKey) return idKey;", "event key helper must prefer numeric id key");
mustContain(page, '].join("|");', "event key helper must create composite fallback key when id is missing");
mustContain(page, "const hasEventId = Boolean(eventId);", "save handler must allow string event ids and composite event keys");
mustContain(page, "id: hasEventId ? eventId : null,", "PATCH payload must send string id or null when only composite key exists");
mustContain(page, "originalEventDate: masterCourtDateInputDateValue(selectedEvent?.eventDate),", "PATCH payload must send original event values for fallback lookup");

mustContain(page, "setMasterEditCourtDatesResult(null);", "edit popup must clear stale result banner on selection or field edits");
mustNotContain(page, 'error: "No Court Date is selected."', "stale no-selection error must not block selected editor save");

mustContain(page, "masterEditCourtDatesSelectedId", "edit popup must track selected Court Date id");
mustContain(page, 'useState<string>("")', "edit popup selected Court Date id must use stable string state");
mustContain(page, "const [masterEditCourtDatesSavingId, setMasterEditCourtDatesSavingId] = useState<string | null>(null);", "edit popup saving state must use stable string event keys, not numeric ids");
mustContain(page, "setMasterEditCourtDatesSavingId(eventKey);", "save handler must set saving state to stable event key");
mustContain(page, "const saving = masterEditCourtDatesSavingId === eventKey;", "edit row saving comparison must use stable event key");
mustNotContain(page, "setMasterEditCourtDatesSavingId(hasEventId ? Number(eventId) || null : null);", "saving state must not coerce string event ids through Number()");
mustNotContain(page, "masterEditCourtDatesSavingId === (Number(eventId) || null)", "saving comparison must not treat non-numeric string ids as null");

mustContain(page, "function masterEditableCourtDatesInDisplayOrder()", "edit popup must provide chooser display order");
mustContain(page, "function selectedMasterEditCourtDate()", "edit popup must provide selected Court Date helper");
mustContain(page, "function masterCourtDateChoiceLabel", "edit popup must render readable Court Date choices");
mustContain(page, "Which Court Date do you want to edit?", "edit popup must ask which Court Date to edit first");
mustContain(page, 'data-barsh-master-edit-court-date-chooser="true"', "edit popup missing chooser marker");
mustContain(page, 'data-barsh-master-edit-court-date-choice-button="true"', "edit popup missing choice button marker");
mustContain(page, 'data-barsh-master-edit-court-date-selected-editor="true"', "edit popup missing selected editor marker");
mustContain(page, 'data-barsh-master-edit-court-date-back-button="true">Back</button>)', "edit popup Back button must render only after a Court Date is selected");

mustContain(page, "function masterCourtDateInputDateValue", "edit popup must normalize date input values to YYYY-MM-DD");
mustContain(page, "const selectedId = masterCourtDateEventKey(courtEvent);", "edit popup choice button must derive selected id from stable event key");
mustContain(page, "setMasterEditCourtDatesSelectedId(selectedId)", "edit popup choice button must store selected event key");
mustContain(page, "setMasterEditCourtDatesForms((current) => ({ ...current, [selectedId]: masterCourtDateEditFormFromEvent(courtEvent) }))", "edit popup must prefill selected Court Date form before launching editor");
mustContain(page, "const form = masterEditCourtDatesForms[eventKey] || masterCourtDateEditFormFromEvent(courtEvent);", "edit row must use selected event keyed prefilled form");

mustContain(page, "function masterCourtDateEditFieldChanged", "edit popup must compare current values against original values");
mustContain(page, "function masterCourtDateEditInputStyle", "edit popup must highlight changed input/select fields");
mustContain(page, "function masterCourtDateEditTextareaStyle", "edit popup must highlight changed notes field");
mustContain(page, 'border: changed ? "2px solid #f97316"', "changed fields must receive orange highlight border");
mustContain(page, 'background: changed ? "#fff7ed" : "#ffffff"', "changed fields must receive highlighted background");

mustContain(page, 'justifyContent: masterEditCourtDatesSelectedId ? "space-between" : "flex-end"', "edit popup footer must hide Back on chooser and show it in editor");
mustContain(page, "Save Changes", "save button label must be Save Changes");
mustNotContain(page, "Save Court Date", "obsolete edit-save label remains in page");
mustNotContain(page, "Save Changes to Appearance", "obsolete long edit-save label remains in page");
mustNotContain(page, "Choose Different Court Date", "obsolete top chooser button remains in page");

mustContain(page, 'setMasterEditCourtDatesResult({ ok: true, message: "Appearance changes saved." });', "successful Save Changes must show inline confirmation");
mustContain(page, "window.setTimeout(() => {", "successful Save Changes must auto-close after showing confirmation");
mustContain(page, "setMasterEditCourtDatesDialogOpen(false);", "successful Save Changes must close the edit dialog after confirmation");
mustNotContain(page, 'window.alert("Appearance changes saved.");', "successful Save Changes must not use blocking alert confirmation");

mustContain(route, "export async function PATCH", "Court Calendar events route missing PATCH handler");
mustContain(route, "prisma.courtCalendarEvent.update", "PATCH handler must update court calendar event");
mustContain(route, "eventSelect()", "PATCH handler must return selected event");
mustContain(route, 'sourceAction: clean(body?.sourceAction) || "edit-court-calendar-event"', "PATCH handler missing edit sourceAction default");
mustContain(route, "const id = clean(body?.id);", "PATCH route must read optional string id");
mustContain(route, "const hasEventId = Boolean(id);", "PATCH route must support optional string id");
mustContain(route, "const originalEventDate = clean(body?.originalEventDate);", "PATCH route must receive original date for fallback lookup");
mustContain(route, "const existing = hasEventId", "PATCH route must lookup by id or original appearance values");
mustContain(route, "where: { id: existing.id }", "PATCH route must update resolved existing event id");

if (failures.length) {
  console.error("FAIL: master court dates edit safety");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: master court dates edit safety");
