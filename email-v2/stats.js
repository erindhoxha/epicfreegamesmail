// Compares each weekly send's opens and clicks, so a new send can be judged against
// past ones at the same number of hours after sending (final totals take ~2 days).
// Read-only: only fetches stats from Mailjet, never sends or changes anything.
// Usage (from the repo root): node email-v2/stats.js [days back, default 70]
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const Mailjet = require("node-mailjet");

const DAYS_BACK = Number(process.argv[2]) || 70;
const MIN_SEND_SIZE = 300; // a day with fewer sent messages is tests/reminders, not a weekly send
const CHECKPOINTS = [1, 2, 3, 6, 12, 24, 48]; // hours after the send started
const HOUR = 3600;
const DAY = 24 * HOUR;

const pct = (part, whole) => (whole ? `${Math.round((100 * part) / whole)}%` : "-");
const pad = (value, width) => String(value).padStart(width);

async function counters(mailjet, { timing, resolution, from, to }) {
  const res = await mailjet.get("statcounters", { version: "v3" }).request(
    {},
    {
      SourceId: process.env.MJ_APIKEY_PUBLIC,
      CounterSource: "APIKey",
      CounterTiming: timing, // Message: counted on the day it was sent; Event: when it happened
      CounterResolution: resolution,
      FromTS: from,
      ToTS: to,
      Limit: 1000,
    },
  );
  return res.body.Data;
}

// Opens and clicks so far at each checkpoint. Event-timed hours also include the odd open of an
// older email, which is a handful at most and the same for every week.
async function hourly(mailjet, dayStart, now) {
  const rows = await counters(mailjet, {
    timing: "Event",
    resolution: "Hour",
    from: dayStart,
    to: Math.min(now, dayStart + 3 * DAY),
  });
  const start = rows.findIndex((r) => r.MessageSentCount > 50);
  if (start === -1) return null;

  // Hours with no activity can be missing from the response, so place rows by timestamp.
  const startTs = Date.parse(rows[start].Timeslice) / 1000;
  const result = { startedAt: rows[start].Timeslice.slice(11, 16), opens: {}, clicks: {} };
  for (const hr of CHECKPOINTS) {
    if (startTs + hr * HOUR > now) break; // that checkpoint hasn't been reached yet
    const upTo = rows.slice(start).filter((r) => Date.parse(r.Timeslice) / 1000 < startTs + hr * HOUR);
    result.opens[hr] = upTo.reduce((sum, r) => sum + (r.MessageOpenedCount || 0), 0);
    result.clicks[hr] = upTo.reduce((sum, r) => sum + (r.MessageClickedCount || 0), 0);
  }
  return result;
}

(async () => {
  const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE } = process.env;
  if (!MJ_APIKEY_PUBLIC || !MJ_APIKEY_PRIVATE) throw new Error("MJ_APIKEY_PUBLIC / MJ_APIKEY_PRIVATE missing");
  const mailjet = Mailjet.apiConnect(MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE);

  const now = Math.floor(Date.now() / 1000);
  const days = await counters(mailjet, { timing: "Message", resolution: "Day", from: now - DAYS_BACK * DAY, to: now });
  const sends = days.filter((d) => d.MessageSentCount >= MIN_SEND_SIZE);
  if (sends.length === 0) return console.log(`No sends of ${MIN_SEND_SIZE}+ emails in the last ${DAYS_BACK} days.`);

  console.log("TOTALS (final once a send is ~2 days old)");
  console.log("date        sent  opened        clicked      click/open  bounced  spam  unsub");
  for (const d of sends) {
    const opened = d.MessageOpenedCount || 0;
    const clicked = d.MessageClickedCount || 0;
    const bounced = (d.MessageSoftBouncedCount || 0) + (d.MessageHardBouncedCount || 0);
    console.log(
      `${d.Timeslice.slice(0, 10)}  ${pad(d.MessageSentCount, 4)}  ${pad(opened, 4)} ${pad(`(${pct(opened, d.MessageSentCount)})`, 6)}` +
        `   ${pad(clicked, 4)} ${pad(`(${pct(clicked, d.MessageSentCount)})`, 5)}   ${pad(pct(clicked, opened), 6)}` +
        `      ${pad(bounced, 5)}  ${pad(d.MessageSpamCount || 0, 4)}  ${pad(d.MessageUnsubscribedCount || 0, 5)}`,
    );
  }

  console.log("\nOPENED BY HOURS AFTER SENDING (% of emails sent)");
  console.log(`date        start  ${CHECKPOINTS.map((h) => pad(`${h}h`, 11)).join("")}   clicks@3h`);
  for (const d of sends) {
    const dayStart = Math.floor(new Date(d.Timeslice).getTime() / 1000);
    const h = await hourly(mailjet, dayStart, now);
    if (!h) {
      console.log(`${d.Timeslice.slice(0, 10)}  no hourly data`);
      continue;
    }
    const cells = CHECKPOINTS.map((hr) =>
      pad(hr in h.opens ? `${h.opens[hr]} ${pct(h.opens[hr], d.MessageSentCount)}` : "", 11),
    ).join("");
    console.log(`${d.Timeslice.slice(0, 10)}  ${h.startedAt}  ${cells}   ${pad(h.clicks[3] ?? "", 9)}`);
  }

  console.log(
    "\nOpens depend on subject, sender and timing; the email's design shows up in click/open." +
      "\nCompare a new send against past ones at the same hour, not against their final totals.",
  );
})().catch((err) => {
  console.error(err.statusCode ? `Mailjet ${err.statusCode}: ${err.message}` : err.message);
  process.exit(1);
});
