const DELAY_MS = 2500;
const RETRY_MS = 4000;
const MIN_DESC_LEN = 40;

function text(el) {
  return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
}

function pickFirst(selectors, root = document) {
  for (const sel of selectors) {
    try {
      const el = root.querySelector(sel);
      if (el && text(el)) return text(el);
    } catch {
      /* invalid selector */
    }
  }
  return "";
}

function pickAllJoined(selectors, root = document, sep = "\n\n") {
  for (const sel of selectors) {
    try {
      const nodes = root.querySelectorAll(sel);
      const parts = [];
      nodes.forEach((el) => {
        const t = text(el);
        if (t.length > 20) parts.push(t);
      });
      if (parts.length) return parts.join(sep);
    } catch {
      /* invalid selector */
    }
  }
  return "";
}

function collectSnippets(selectors, root = document, max = 8) {
  const out = [];
  for (const sel of selectors) {
    root.querySelectorAll(sel).forEach((el) => {
      const t = text(el);
      if (t && t.length > 12 && out.length < max && !out.includes(t)) out.push(t);
    });
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

function linkedInCompanyFromLinks(root = document) {
  const skip = /apply|sign in|join|show more|see more|linkedin|cookie/i;
  const links = root.querySelectorAll(
    'a[href*="/company/"], a[data-tracking-control-name*="org-name"], a[data-tracking-control-name*="company"]'
  );
  for (const a of links) {
    const t = text(a);
    if (t.length >= 2 && t.length < 120 && !skip.test(t)) return t;
  }
  return "";
}

function linkedInDescriptionFallback() {
  const joined = pickAllJoined(
    [
      ".jobs-description-content__text",
      ".jobs-description__text",
      ".jobs-box__html-content",
      ".show-more-less-html",
      "[class*='job-details-about'] [class*='description']",
      "[class*='jobs-description']",
      ".description__text",
      "article.jobs-description",
    ],
    document
  );
  if (joined.length >= MIN_DESC_LEN) return joined;

  const art =
    document.querySelector(
      "article.jobs-description, article[class*='job-details'], .jobs-description, #job-details"
    ) || document.querySelector("main article");
  if (art) {
    const t = text(art);
    if (t.length >= MIN_DESC_LEN) return t;
  }

  const main = document.querySelector("main");
  if (main) {
    const blocks = main.querySelectorAll("p, li");
    let acc = "";
    blocks.forEach((el) => {
      const t = text(el);
      if (t.length > 80) acc = acc ? `${acc}\n\n${t}` : t;
    });
    if (acc.length >= MIN_DESC_LEN) return acc;
  }

  return "";
}

function scrapeLinkedIn() {
  const titleSelectors = [
    "h1.jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    ".jobs-details-top-card__title-text",
    ".jobs-details-top-card__main-content h1",
    "h1[data-test-job-details-header]",
    ".job-details-jobs-unified-top-card__job-title",
    "h1.top-card-layout__title",
    "[class*='jobs-details-top-card'] h1",
    "[class*='job-details-jobs-unified'] h1",
    "main h1",
    ".scaffold-layout__main h1",
  ];
  const companySelectors = [
    ".job-details-jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__subtitle a",
    ".jobs-unified-top-card__subtitle",
    ".jobs-details-top-card__company-name a",
    ".jobs-details-top-card__company-name",
    "a.job-details-jumper__company-name",
    ".jobs-unified-top-card__primary-description-container a",
    "[data-test-job-details-header] + * a",
    "a[href*='/company/']",
  ];

  let title = pickFirst(titleSelectors);
  if (!title) {
    const h1 = document.querySelector("h1");
    title = text(h1);
  }

  let company = pickFirst(companySelectors);
  if (!company) {
    company = linkedInCompanyFromLinks(document);
  }
  if (!company) {
    const sub = document.querySelector(
      ".jobs-unified-top-card__subtitle, .jobs-details-top-card__primary-description, [class*='top-card'] .t-14, [class*='top-card'] .t-16"
    );
    company = text(sub).split("·")[0].trim();
  }

  let description = pickFirst([
    ".jobs-description-content__text",
    ".jobs-description__text",
    ".jobs-box__html-content",
    ".show-more-less-html",
    "#job-details > span",
    "article.jobs-description",
  ]);
  if (!description || description.length < MIN_DESC_LEN) {
    const art = document.querySelector("article.jobs-description, .jobs-description");
    if (art) description = text(art);
  }
  if (!description || description.length < MIN_DESC_LEN) {
    const fb = linkedInDescriptionFallback();
    if (fb) description = fb;
  }

  const reviewSelectors = [
    ".jobs-review-summary__snippet",
    ".review-snippet",
    "[data-test-review-snippet]",
  ];
  const reviewSnippets = collectSnippets(reviewSelectors, document, 8);

  return { title, company, description, reviewSnippets, host: "linkedin" };
}

function scrapeGlassdoor() {
  const titleSelectors = [
    "[data-test='jobTitle']",
    "[data-test='job-title']",
    "[data-test='job-title-h1']",
    ".jobTitle",
    "header h1",
    "main h1",
    "h1",
  ];
  const companySelectors = [
    "[data-test='employerName']",
    "a[data-test='employer-name']",
    ".jobDetailsHeader a[href*='/Overview/']",
    ".employerName",
    "div[data-test='employer-name']",
  ];
  const descSelectors = [
    "[data-test='jobDescriptionText']",
    "#JobDescriptionContainer",
    ".jobDescriptionContent",
    ".desc",
  ];

  let title = pickFirst(titleSelectors);

  let company = pickFirst(companySelectors);
  if (!company) {
    const sub = document.querySelector(".subTitle, [class*='JobDetails_subTitle']");
    company = text(sub);
  }

  let description = pickFirst(descSelectors);
  if (!description) {
    const descRoot =
      document.querySelector("[data-test='jobDescriptionText']") ||
      document.querySelector(".jobDescriptionContent") ||
      document.querySelector("[class*='JobDetails_jobDescription']");
    if (descRoot) description = text(descRoot);
  }

  const reviewSelectors = [
    "[data-test='reviewSnippet']",
    ".reviewSnippet",
    ".ReviewSnippet",
    ".review-text",
    "li[data-test='pros-item']",
    "li[data-test='cons-item']",
  ];
  const reviewSnippets = collectSnippets(reviewSelectors, document, 8);

  return { title, company, description, reviewSnippets, host: "glassdoor" };
}

function buildCultureSignals(reviewSnippets) {
  if (!reviewSnippets?.length) return "";
  return reviewSnippets.slice(0, 8).join(" \n");
}

function buildPayload(data, href) {
  const { title, company, description, reviewSnippets } = data;
  const hasCore = Boolean(
    title &&
      company &&
      description &&
      description.replace(/\s/g, " ").trim().length >= MIN_DESC_LEN
  );
  const manualMode = !hasCore;

  return {
    jobTitle: title || "",
    companyName: company || "",
    jobDescription: description || "",
    reviewSnippets: reviewSnippets || [],
    cultureSignals: buildCultureSignals(reviewSnippets),
    manualMode,
    scrapedAt: new Date().toISOString(),
    url: href,
  };
}

function scrapePage(href) {
  try {
    if (href.includes("linkedin.com")) return scrapeLinkedIn();
    return scrapeGlassdoor();
  } catch {
    return { title: "", company: "", description: "", reviewSnippets: [], host: "unknown" };
  }
}

function sendPayload(payload) {
  try {
    chrome.runtime.sendMessage({ type: "PAGE_DATA", payload });
  } catch {
    /* extension context invalidated */
  }
}

function runScrape() {
  const href = window.location.href;
  const first = buildPayload(scrapePage(href), href);
  sendPayload(first);

  if (!first.manualMode) return;

  setTimeout(() => {
    const second = buildPayload(scrapePage(href), href);
    const preferSecond =
      !second.manualMode ||
      (second.jobDescription || "").length > (first.jobDescription || "").length;
    sendPayload(preferSecond ? second : first);
  }, RETRY_MS);
}

setTimeout(runScrape, DELAY_MS);
