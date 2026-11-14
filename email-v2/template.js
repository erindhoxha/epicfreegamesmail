// Email HTML built in code for Epic Free Games Mail.
//
// Card per game (image, title, date, description, button), in a restrained
// black/white/grey palette. No coloured badges or accent borders.
//
// Light is the default (inline styles). Dark mode comes from a prefers-color-scheme
// <style> block, which Apple Mail, iOS Mail and Outlook (mac/iOS) honour.
// Gmail ignores that block and auto-darkens light emails on its own, which looks fine;
// a dark-first email is what Gmail inverts into white, so don't go back to that.

const LIGHT = {
  page: "#FFFFFF", // no visible frame around the cards
  card: "#FFFFFF",
  border: "#E4E4E7",
  ink: "#18181B",
  text: "#3F3F46",
  muted: "#71717A",
  btnBg: "#3B5BDB", // site "Sign up" button
  btnText: "#FFFFFF",
  link: "#3B5BDB",
  tagBg: "#F4F4F5",
};

const DARK = {
  page: "#1A1A1C", // same grey as the website
  card: "#1A1A1C",
  border: "#2A2A2E",
  ink: "#FAFAFA",
  text: "#D4D4D8",
  muted: "#A1A1AA",
  btnBg: "#3B5BDB",
  btnText: "#FFFFFF",
  link: "#8DA2F5", // lighter blue so links stay readable on dark
  tagBg: "#27272A",
};

const C = LIGHT;
// Same stack as the website (styles/custom.css).
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const STEAM_URL = "https://steamfreegamesmail.com/?utm_source=efgm&utm_medium=email&utm_campaign=crosspromo";
const SITE_URL = "https://epicfreegamesmail.com";
const COFFEE_URL = "https://www.buymeacoffee.com/erindhoxha";

// Each class swaps one colour in dark mode. Outlook's phone apps mark dark mode with
// [data-ogsc] (text colours) and [data-ogsb] (backgrounds), so the rules are repeated for both.
const darkRules = (p = "") => `
  ${p}.bg { background:${DARK.page} !important; }
  ${p}.card { background:${DARK.card} !important; border-color:${DARK.border} !important; }
  ${p}.rule { border-color:${DARK.border} !important; }
  ${p}.ink, ${p}.ink a { color:${DARK.ink} !important; }
  ${p}.txt, ${p}.txt a { color:${DARK.text} !important; }
  ${p}.muted, ${p}.muted a { color:${DARK.muted} !important; }
  ${p}.tag { background:${DARK.tagBg} !important; color:${DARK.text} !important; }
  ${p}.btn { background:${DARK.btnBg} !important; }
  ${p}.btn a { color:${DARK.btnText} !important; }
  ${p}a.link { color:${DARK.link} !important; }`;

const STYLE = `<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {${darkRules()}
  }
  ${darkRules("[data-ogsc] ")}
  ${darkRules("[data-ogsb] ")}
  /* Gmail only (u + .body): keeps white button text white in Gmail's own dark mode.
     The button colour itself is protected by background-image, which Gmail doesn't recolour. */
  u + .body .gm-screen { background:#000; mix-blend-mode:screen; display:inline-block; }
  u + .body .gm-diff { background:#000; mix-blend-mode:difference; display:inline-block; }
  @media (max-width: 480px) { .pad { padding-left:20px !important; padding-right:20px !important; } }
</style>`;

const esc = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );

const truncate = (text, max = 170) => {
  if (!text || text.length <= max) return text || "";
  return `${text.slice(0, text.lastIndexOf(" ", max)).replace(/[,.;:]$/, "")}…`;
};

const p = (html, { cls = "txt", size = 15, color = C.text, margin = "0 0 12px", extra = "" } = {}) =>
  `<p class="${cls}" style="margin:${margin};font-family:${FONT};font-size:${size}px;line-height:1.55;color:${color};${extra}">${html}</p>`;

const link = (href, label, cls = "link", color = C.link) =>
  `<a class="${cls}" href="${esc(href)}" target="_blank" style="color:${color};text-decoration:underline;text-underline-offset:2px;">${label}</a>`;

const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td class="btn" bgcolor="${C.btnBg}" style="border-radius:6px;background:${C.btnBg};background-image:linear-gradient(${C.btnBg},${C.btnBg});">
      <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.btnText};text-decoration:none;"><span class="gm-screen"><span class="gm-diff">${label}&nbsp;&rarr;</span></span></a>
    </td>
  </tr></table>`;

// Small neutral label, e.g. "Free now" / "Next week". Grey, never coloured.
const tag = (label) =>
  `<span class="tag" style="display:inline-block;padding:3px 8px;border-radius:4px;background:${C.tagBg};font-family:${FONT};font-size:12px;font-weight:600;color:${C.text};">${label}</span>`;

function tagFor(item) {
  if (item.isFree) return "Free now";
  if (item.isDiscount) return "On sale";
  return "Next week";
}

// The tag already says "Free now" / "Next week", so drop that from the date line:
// "Free now until 19th of November…" -> "Until 19th of November…"
const dateLine = (status) =>
  status
    .replace(/^(Free|Discounted) now until /, "Until ")
    .replace(/^Coming soon from /, "From ")
    .replace(/^Coming soon$/, "Date to be announced");

function priceLine(item) {
  if (!item.price) return "";
  const now = item.isFree ? "Free" : esc(item.discountedPrice);
  return p(
    `<span class="muted" style="text-decoration:line-through;color:${C.muted};">${esc(item.price)}</span>&nbsp;&nbsp;<strong class="ink" style="color:${C.ink};">${now}</strong>`,
    { margin: "0 0 18px" },
  );
}

function gameCard(item) {
  const img = item.image
    ? `<tr><td>${item.url ? `<a href="${esc(item.url)}" target="_blank">` : ""}<img src="${esc(item.image)}" width="552" alt="${esc(item.title)}" style="display:block;width:100%;max-width:552px;height:auto;border:0;border-radius:8px 8px 0 0;">${item.url ? "</a>" : ""}</td></tr>`
    : "";
  return `
  <tr><td style="padding:0 0 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-radius:8px;">
      ${img}
      <tr><td class="pad" style="padding:20px 24px 24px;">
        <p style="margin:0 0 10px;">${tag(tagFor(item))}</p>
        ${p(esc(item.title), { cls: "ink", size: 20, color: C.ink, margin: "0 0 4px", extra: "font-weight:700;line-height:1.3;" })}
        ${p(esc(dateLine(item.status)), { cls: "muted", size: 14, color: C.muted, margin: "0 0 12px" })}
        ${item.description ? p(esc(truncate(item.description)), { margin: "0 0 16px" }) : ""}
        ${priceLine(item)}
        ${item.url ? button(item.url, item.isFree ? "Claim on Epic" : "See the deal") : ""}
      </td></tr>
    </table>
  </td></tr>`;
}

const steamNote = () => `
  <tr><td style="padding:12px 4px 8px;">
    ${p(`<strong class="ink" style="color:${C.ink};">P.S.</strong> I also run a Steam version that emails you when Steam games go 100% off or are free for the weekend. ${link(STEAM_URL, "Sign up here")} if you play on Steam too.`, { margin: "0 0 14px" })}
    ${p(`If these emails save you some money, you can ${link(COFFEE_URL, "buy me a coffee")}. Thanks for reading!`, { margin: "0 0 4px" })}
    ${p("Erind", { cls: "ink", color: C.ink, margin: "0", extra: "font-weight:600;" })}
  </td></tr>`;

const footer = () => `
  <tr><td style="padding:24px 4px 0;"><div class="rule" style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</div></td></tr>
  <tr><td style="padding:16px 4px 0;">
    ${p(`You're getting this because you signed up at ${link(SITE_URL, "epicfreegamesmail.com", "muted", C.muted)}.`, { cls: "muted", size: 12, color: C.muted, margin: "0 0 4px" })}
    ${p(link("[[UNSUB_LINK_EN]]", "Unsubscribe", "muted", C.muted), { cls: "muted", size: 12, color: C.muted, margin: "0 0 4px" })}
    ${p("Not affiliated with Epic Games.", { cls: "muted", size: 12, color: C.muted, margin: "0" })}
  </td></tr>`;

function buildHtml(items) {
  const free = items.filter((i) => i.isFree);
  const preheader = free.length
    ? `Free on Epic this week: ${free.map((i) => i.title).join(", ")}`
    : "This week's Epic Games Store deals";

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>Epic Free Games Mail</title>
${STYLE}
</head>
<body class="body bg" style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" bgcolor="${C.page}" style="background:${C.page};"><tr><td align="center" style="padding:32px 16px 40px;">
  <table role="presentation" width="552" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:552px;">
    <tr><td style="padding:0 4px 24px;">
      ${p("Epic Free Games Mail", { cls: "muted", size: 13, color: C.muted, margin: "0 0 14px", extra: "font-weight:600;" })}
      ${p("Free this week on the Epic Games Store", { cls: "ink", size: 26, color: C.ink, margin: "0 0 8px", extra: "font-weight:700;line-height:1.25;letter-spacing:-0.3px;" })}
      ${p("Claim them before the deadline and they're yours to keep.", { cls: "muted", color: C.muted, margin: "0" })}
    </td></tr>
    ${items.map(gameCard).join("")}
    ${steamNote()}
    ${footer()}
  </table>
</td></tr></table>
</body></html>`;
}

function buildText(items) {
  const lines = ["Free this week on the Epic Games Store", ""];
  for (const item of items) {
    lines.push(item.title, item.status);
    if (item.url) lines.push(item.url);
    lines.push("");
  }
  lines.push(
    "P.S. I also run a Steam version that emails you when Steam games go 100% off or are free for the weekend:",
    STEAM_URL,
    "",
    `Buy me a coffee: ${COFFEE_URL}`,
    "Erind",
    "",
    "Unsubscribe: [[UNSUB_LINK_EN]]",
  );
  return lines.join("\n");
}

module.exports = { buildHtml, buildText };
