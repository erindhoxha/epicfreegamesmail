// Sends the new email design to ONE test address only. Never touches the subscriber list.
// Usage (from the repo root): node email-v2/send-test.js [recipient@example.com]
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const Mailjet = require("node-mailjet");
const { fetchItems } = require("./items");
const { buildHtml, buildText } = require("./template");

const TO = process.argv[2] || process.env.TEST_EMAIL || "hello@erindhoxha.dev";

(async () => {
  const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE } = process.env;
  if (!MJ_APIKEY_PUBLIC || !MJ_APIKEY_PRIVATE)
    throw new Error("MJ_APIKEY_PUBLIC / MJ_APIKEY_PRIVATE missing from .env");

  const items = await fetchItems();
  const mailjet = Mailjet.apiConnect(MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE);

  const result = await mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: { Email: "hello@epicfreegamesmail.com", Name: "EFGM Newsletter" },
        To: [{ Email: TO }],
        Subject: `[TEST v2] Claim this week's games - ${new Date().toDateString()}`,
        HTMLPart: buildHtml(items),
        TextPart: buildText(items),
        TemplateLanguage: true, // lets Mailjet fill in [[UNSUB_LINK_EN]]
        CustomCampaign: "efgm-v2-test",
      },
    ],
  });

  const msg = result.body.Messages[0];
  console.log(`${msg.Status}: ${items.length} games sent to ${TO}`);
})().catch((err) => {
  console.error(err.statusCode ? `Mailjet ${err.statusCode}: ${err.message}` : err.message);
  process.exit(1);
});
