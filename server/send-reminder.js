// Emails a "review and send" reminder after the weekly test copy goes out.
// Run by .github/workflows/weekly-test-reminder.yml every Thursday.
const Mailjet = require("node-mailjet");
require("dotenv").config({ path: "../.env" });

const REMINDER_TO = "hello@erindhoxha.dev";
const SEND_WORKFLOW_URL =
  "https://github.com/erindhoxha/epicfreegamesmail/actions/workflows/mailjet-send.yml";

const mailjet = Mailjet.apiConnect(process.env.MJ_APIKEY_PUBLIC, process.env.MJ_APIKEY_PRIVATE);

const date = new Date().toDateString();

mailjet
  .post("send", { version: "v3.1" })
  .request({
    Messages: [
      {
        From: { Email: "hello@epicfreegamesmail.com", Name: "EFGM bot" },
        To: [{ Email: REMINDER_TO }],
        Subject: `Review needed: this week's Epic email (${date})`,
        TextPart: [
          "This week's test copy has been sent to your inbox. Nothing has gone to subscribers yet.",
          "",
          "1. Check the test email (games, dates, links, images).",
          `2. Open the send workflow: ${SEND_WORKFLOW_URL}`,
          '3. Click "Run workflow" on master to send it to the EpicFreeGamesMail list.',
        ].join("\n"),
        HTMLPart: `<p>This week's test copy has been sent to your inbox. Nothing has gone to subscribers yet.</p>
<ol>
  <li>Check the test email (games, dates, links, images).</li>
  <li>Open the <a href="${SEND_WORKFLOW_URL}">Send Mailjet Emails</a> workflow.</li>
  <li>Click <b>Run workflow</b> on <code>master</code> to send it to the EpicFreeGamesMail list.</li>
</ol>`,
      },
    ],
  })
  .then(() => console.log(`reminder sent to ${REMINDER_TO}`))
  .catch((err) => {
    console.error(err.response?.data ? JSON.stringify(err.response.data) : err.message);
    process.exit(1);
  });
