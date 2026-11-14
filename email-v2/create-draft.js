// Creates this week's Mailjet campaign draft with the V2 email, sends a test copy and
// a "review and send" reminder. Nothing reaches subscribers until you open the draft
// in Mailjet and click Send.
// Usage (from the repo root): node email-v2/create-draft.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const Mailjet = require("node-mailjet");
const { fetchItems } = require("./items");
const { buildHtml, buildText } = require("./template");

const CONTACT_LIST_ID = 10422731; // EpicFreeGamesMail list
const SENDER_EMAIL = "hello@epicfreegamesmail.com";
const SENDER_NAME = "EFGM Newsletter";
const REVIEWER = process.env.TEST_EMAIL || "hello@erindhoxha.dev";
const MAILJET_CAMPAIGNS_URL = "https://app.mailjet.com/campaigns";

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function createDraft(mailjet, { subject, title, html, text }) {
  const campaigns = mailjet.post("campaigndraft", { version: "v3" });
  const draft = await campaigns.request({
    Locale: "en_US",
    Sender: SENDER_NAME,
    SenderName: SENDER_NAME,
    SenderEmail: SENDER_EMAIL,
    Subject: subject,
    ContactsListID: CONTACT_LIST_ID,
    Title: title.slice(0, 250),
  });
  const id = draft.body.Data[0].ID;

  await mailjet
    .post("campaigndraft", { version: "v3" })
    .id(id)
    .action("detailcontent")
    .request({ "Html-part": html, "Text-part": text });

  await mailjet
    .post("campaigndraft", { version: "v3" })
    .id(id)
    .action("test")
    .request({ Recipients: [{ Email: REVIEWER, Name: "Review" }] });

  return id;
}

// A plain nudge, separate from the test copy, so a waiting draft doesn't get missed.
async function sendReminder(mailjet, { id, subject, items }) {
  const lines = items.map((i) => `- ${i.title}: ${i.status}`);
  await mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: { Email: SENDER_EMAIL, Name: "EFGM bot" },
        To: [{ Email: REVIEWER }],
        Subject: `Review needed: Epic draft ready (${new Date().toDateString()})`,
        TextPart: [
          "This week's Epic Free Games Mail draft is waiting in Mailjet. Nothing has been sent to subscribers.",
          "",
          `Draft #${id}: "${subject}"`,
          ...lines,
          "",
          "1. Check the test copy in your inbox.",
          `2. Open Mailjet > Campaigns > Drafts: ${MAILJET_CAMPAIGNS_URL}`,
          "3. Click Send (or schedule it).",
        ].join("\n"),
        HTMLPart: `<p>This week's Epic Free Games Mail draft is waiting in Mailjet. Nothing has been sent to subscribers.</p>
<p><b>Draft #${id}:</b> ${esc(subject)}</p>
<ul>${items.map((i) => `<li><b>${esc(i.title)}</b>: ${esc(i.status)}</li>`).join("")}</ul>
<ol><li>Check the test copy in your inbox.</li><li>Open <a href="${MAILJET_CAMPAIGNS_URL}">Mailjet &rsaquo; Campaigns &rsaquo; Drafts</a>.</li><li>Click <b>Send</b> (or schedule it).</li></ol>`,
      },
    ],
  });
}

(async () => {
  const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE } = process.env;
  if (!MJ_APIKEY_PUBLIC || !MJ_APIKEY_PRIVATE) throw new Error("MJ_APIKEY_PUBLIC / MJ_APIKEY_PRIVATE missing");

  const items = await fetchItems();
  if (items.length === 0) throw new Error("No games found in the Epic feed; not creating an empty draft.");

  const date = new Date().toDateString();
  const subject = `Claim this week's games - ${date}`;
  const title = `Epic ${new Date().toISOString().slice(0, 10)}: ${items.map((i) => i.title).join(", ")}`;

  const mailjet = Mailjet.apiConnect(MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE);
  const id = await createDraft(mailjet, { subject, title, html: buildHtml(items), text: buildText(items) });
  console.log(`created draft ${id} "${subject}" with ${items.length} games, test sent to ${REVIEWER}`);

  try {
    await sendReminder(mailjet, { id, subject, items });
    console.log(`reminder sent to ${REVIEWER}`);
  } catch (err) {
    // The draft exists either way, so don't fail the run over the reminder.
    console.error(`reminder failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
  }
})().catch((err) => {
  console.error(err.response?.data ? JSON.stringify(err.response.data) : err.message);
  process.exit(1);
});
