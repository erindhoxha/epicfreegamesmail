// Sends the new email design to the WHOLE EpicFreeGamesMail list.
// Same list, batch size and pacing as server/mailjet-send-template.js.
// Refuses to run without --confirm so it can't go out by accident.
// Usage (from the repo root): node email-v2/send.js --confirm
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const Mailjet = require("node-mailjet");
const { fetchItems } = require("./items");
const { buildHtml, buildText } = require("./template");

const CONTACT_LIST_ID = 10422731;
const BATCH_SIZE = 50; // Mailjet's max messages per Send API call
const BATCH_DELAY_MS = 11000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  if (!process.argv.includes("--confirm")) {
    throw new Error("This emails every subscriber. Re-run with --confirm to send.");
  }
  const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE } = process.env;
  if (!MJ_APIKEY_PUBLIC || !MJ_APIKEY_PRIVATE) throw new Error("MJ_APIKEY_PUBLIC / MJ_APIKEY_PRIVATE missing");

  const items = await fetchItems();
  if (items.length === 0) throw new Error("No games found in the Epic feed; not sending an empty email.");

  const mailjet = Mailjet.apiConnect(MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE);
  const html = buildHtml(items);
  const text = buildText(items);
  const subject = `Claim this week's games - ${new Date().toDateString()}`;

  let offset = 0;
  let sent = 0;
  for (;;) {
    const contacts = await mailjet
      .get("contact")
      .request({}, { ContactsList: CONTACT_LIST_ID, limit: BATCH_SIZE, offset });
    const batch = contacts.body.Data;
    if (batch.length === 0) break;

    const result = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: batch.map((contact) => ({
        From: { Email: "hello@epicfreegamesmail.com", Name: "EFGM Newsletter" },
        To: [{ Email: contact.Email }],
        Subject: subject,
        HTMLPart: html,
        TextPart: text,
        TemplateLanguage: true, // lets Mailjet fill in [[UNSUB_LINK_EN]]
        CustomCampaign: "efgm-v2",
      })),
    });

    const failed = result.body.Messages.filter((m) => m.Status !== "success");
    sent += batch.length - failed.length;
    console.log(`batch at ${offset}: ${batch.length - failed.length}/${batch.length} sent`);
    if (failed.length) console.log(JSON.stringify(failed, null, 2));

    offset += BATCH_SIZE;
    await sleep(BATCH_DELAY_MS);
  }

  console.log(`done: ${sent} emails sent with ${items.length} games`);
})().catch((err) => {
  console.error(err.statusCode ? `Mailjet ${err.statusCode}: ${err.message}` : err.message);
  process.exit(1);
});
