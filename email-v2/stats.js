// Compares each weekly send's opens and clicks, so a new send can be judged against
// past ones at the same number of hours after sending (final totals take ~2 days).
// Only reads stats from Mailjet. With --email it also mails a summary of the last
// few sends to you (TEST_EMAIL); it never emails subscribers or changes anything.
// Usage (from the repo root):
//   node email-v2/stats.js [days back, default 70]   print to the terminal
//   node email-v2/stats.js --email                    email the last 5 sends to TEST_EMAIL
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const Mailjet = require("node-mailjet");

const EMAIL = process.argv.includes("--email");
const DAYS_BACK = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 70;
const EMAIL_SENDS = 5;
const REPORT_TO = process.env.TEST_EMAIL || "hello@erindhoxha.dev";
const MIN_SEND_SIZE = 300; // a day with fewer sent messages is tests/reminders, not a weekly send
const CHECKPOINTS = [1, 2, 3, 6, 12, 24, 48]; // hours after the send started
const HOUR = 3600;
const DAY = 24 * HOUR;

const pct = (part, whole) => (whole ? `${Math.round((100 * part) / whole)}%` : "-");
const pad = (value, width) => String(value ?? "").padStart(width);

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
  const result = { startTs, startedAt: rows[start].Timeslice.slice(11, 16), opens: {}, clicks: {} };
  for (const hr of CHECKPOINTS) {
    if (startTs + hr * HOUR > now) break; // that checkpoint hasn't been reached yet
    const upTo = rows.slice(start).filter((r) => Date.parse(r.Timeslice) / 1000 < startTs + hr * HOUR);
    result.opens[hr] = upTo.reduce((sum, r) => sum + (r.MessageOpenedCount || 0), 0);
    result.clicks[hr] = upTo.reduce((sum, r) => sum + (r.MessageClickedCount || 0), 0);
  }
  return result;
}

async function collect(mailjet, now) {
  const days = await counters(mailjet, { timing: "Message", resolution: "Day", from: now - DAYS_BACK * DAY, to: now });
  const sends = [];
  for (const d of days.filter((day) => day.MessageSentCount >= MIN_SEND_SIZE)) {
    const h = await hourly(mailjet, Date.parse(d.Timeslice) / 1000, now);
    sends.push({
      date: d.Timeslice.slice(0, 10),
      sent: d.MessageSentCount,
      opened: d.MessageOpenedCount || 0,
      clicked: d.MessageClickedCount || 0,
      bounced: (d.MessageSoftBouncedCount || 0) + (d.MessageHardBouncedCount || 0),
      spam: d.MessageSpamCount || 0,
      unsub: d.MessageUnsubscribedCount || 0,
      hourly: h,
      final: h ? now - h.startTs >= 2 * DAY : true,
    });
  }
  return sends;
}

function printText(sends) {
  console.log("TOTALS (final once a send is ~2 days old)");
  console.log("date        sent  opened        clicked      click/open  bounced  spam  unsub");
  for (const s of sends) {
    console.log(
      `${s.date}  ${pad(s.sent, 4)}  ${pad(s.opened, 4)} ${pad(`(${pct(s.opened, s.sent)})`, 6)}` +
        `   ${pad(s.clicked, 4)} ${pad(`(${pct(s.clicked, s.sent)})`, 5)}   ${pad(pct(s.clicked, s.opened), 6)}` +
        `      ${pad(s.bounced, 5)}  ${pad(s.spam, 4)}  ${pad(s.unsub, 5)}${s.final ? "" : "  (still counting)"}`,
    );
  }

  console.log("\nOPENED BY HOURS AFTER SENDING (% of emails sent)");
  console.log(`date        start  ${CHECKPOINTS.map((h) => pad(`${h}h`, 11)).join("")}   clicks@3h`);
  for (const s of sends) {
    const h = s.hourly;
    if (!h) {
      console.log(`${s.date}  no hourly data`);
      continue;
    }
    const cells = CHECKPOINTS.map((hr) => pad(hr in h.opens ? `${h.opens[hr]} ${pct(h.opens[hr], s.sent)}` : "", 11)).join("");
    console.log(`${s.date}  ${h.startedAt}  ${cells}   ${pad(h.clicks[3], 9)}`);
  }

  console.log(
    "\nOpens depend on subject, sender and timing; the email's design shows up in click/open." +
      "\nCompare a new send against past ones at the same hour, not against their final totals.",
  );
}

// One line comparing the newest send with the ones before it, at the latest hour it has reached.
function headline(sends) {
  const [latest, ...older] = [...sends].reverse();
  const hr = [...CHECKPOINTS].reverse().find((c) => latest.hourly && c in latest.hourly.opens);
  const past = older.filter((s) => s.hourly && hr in s.hourly.opens);
  if (!hr || past.length === 0) return `Latest send: ${latest.date}.`;

  const avg = (f) => Math.round(past.reduce((sum, s) => sum + f(s), 0) / past.length);
  const rate = (s) => (100 * s.hourly.opens[hr]) / s.sent;
  return (
    `Latest send (${latest.date}) at ${hr}h: ${latest.hourly.opens[hr]} opens (${Math.round(rate(latest))}% of sent) ` +
    `and ${latest.hourly.clicks[hr]} clicks. The ${past.length} sends before it averaged ` +
    `${avg(rate)}% opened and ${avg((s) => s.hourly.clicks[hr])} clicks at ${hr}h.`
  );
}

function buildEmail(sends) {
  const th = (t) => `<th style="text-align:right;padding:6px 10px;border-bottom:1px solid #ddd;font-weight:600">${t}</th>`;
  const td = (t) => `<td style="text-align:right;padding:6px 10px;border-bottom:1px solid #eee">${t}</td>`;
  const at = (s, kind, hr) => (s.hourly && hr in s.hourly[kind] ? s.hourly[kind][hr] : "–");

  const rows = sends
    .map(
      (s) =>
        `<tr>${td(`${s.date}${s.final ? "" : "*"}`)}${td(s.sent)}${td(`${s.opened} (${pct(s.opened, s.sent)})`)}` +
        `${td(s.clicked)}${td(pct(s.clicked, s.opened))}${td(at(s, "opens", 3))}${td(at(s, "clicks", 3))}` +
        `${td(at(s, "opens", 24))}${td(s.bounced)}${td(s.spam)}${td(s.unsub)}</tr>`,
    )
    .join("");
  const summary = headline(sends);
  const note =
    "* still counting: final totals arrive about 2 days after a send. Compare sends at the same hour " +
    "(3h, 24h columns). Opens depend on subject, sender and timing; the email's design shows up in click/open.";

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;color:#18181B">
<p>${summary}</p>
<table style="border-collapse:collapse;font-size:13px">
<tr>${["Send", "Sent", "Opened", "Clicked", "Click/open", "Opens 3h", "Clicks 3h", "Opens 24h", "Bounced", "Spam", "Unsub"].map(th).join("")}</tr>
${rows}
</table>
<p style="color:#71717A;font-size:12px">${note}<br>Generated by email-v2/stats.js; run it locally for the hour-by-hour table.</p>
</div>`;

  const text = [
    summary,
    "",
    "send         sent  opened  clicked  click/open  opens3h  clicks3h  opens24h  bounced spam unsub",
    ...sends.map(
      (s) =>
        `${s.date}${s.final ? " " : "*"}  ${pad(s.sent, 4)}  ${pad(s.opened, 6)}  ${pad(s.clicked, 7)}  ${pad(pct(s.clicked, s.opened), 10)}` +
        `  ${pad(at(s, "opens", 3), 7)}  ${pad(at(s, "clicks", 3), 8)}  ${pad(at(s, "opens", 24), 8)}  ${pad(s.bounced, 7)} ${pad(s.spam, 4)} ${pad(s.unsub, 5)}`,
    ),
    "",
    note,
  ].join("\n");

  return { html, text };
}

(async () => {
  const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE } = process.env;
  if (!MJ_APIKEY_PUBLIC || !MJ_APIKEY_PRIVATE) throw new Error("MJ_APIKEY_PUBLIC / MJ_APIKEY_PRIVATE missing");
  const mailjet = Mailjet.apiConnect(MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE);

  const now = Math.floor(Date.now() / 1000);
  const sends = await collect(mailjet, now);
  if (sends.length === 0) return console.log(`No sends of ${MIN_SEND_SIZE}+ emails in the last ${DAYS_BACK} days.`);

  if (!EMAIL) return printText(sends);

  const { html, text } = buildEmail(sends.slice(-EMAIL_SENDS));
  await mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: { Email: "hello@epicfreegamesmail.com", Name: "EFGM bot" },
        To: [{ Email: REPORT_TO }],
        Subject: `EFGM stats: last ${Math.min(EMAIL_SENDS, sends.length)} sends (${new Date().toDateString()})`,
        HTMLPart: html,
        TextPart: text,
        TrackOpens: "disabled", // keep this report out of the open/click numbers it reports
        TrackClicks: "disabled",
      },
    ],
  });
  console.log(`stats email sent to ${REPORT_TO}`);
})().catch((err) => {
  console.error(err.statusCode ? `Mailjet ${err.statusCode}: ${err.message}` : err.message);
  process.exit(1);
});
