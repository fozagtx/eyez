import { type Browser, type Page, chromium } from "playwright";

const MAX_CONCURRENT = 3;
const MAX_CONTENT_LENGTH = 100_000;
let browserPromise: Promise<Browser> | null = null;
let activeCaptures = 0;

interface CaptureOptions {
  timeout?: number;
  scroll?: boolean;
}

export interface CapturedHeading {
  level: string;
  text: string;
}

export interface CapturedLink {
  text: string;
  href: string;
}

export interface CaptureResult {
  title: string;
  description: string;
  headings: CapturedHeading[];
  links: CapturedLink[];
  content: string;
  url: string;
  capturedAt: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export async function captureUrl(
  url: string,
  { timeout = 30000, scroll = true }: CaptureOptions = {},
): Promise<CaptureResult> {
  if (activeCaptures >= MAX_CONCURRENT) {
    throw new Error("Too many concurrent captures, try again later");
  }
  activeCaptures++;

  let page: Page | undefined;
  try {
    const b = await getBrowser();
    page = await b.newPage();
  } catch (err) {
    activeCaptures--;
    browserPromise = null; // Reset on browser failure
    throw new Error(`Browser launch failed: ${getErrorMessage(err)}`, {
      cause: err,
    });
  }

  try {
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout });

    // Smart wait: poll until content stabilizes
    let prevLen = 0;
    let stableCount = 0;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(250);
      const curLen = await page.evaluate(() => document.body.innerText.length);
      if (curLen === prevLen && curLen > 100) {
        stableCount++;
        if (stableCount >= 2) break;
      } else {
        stableCount = 0;
      }
      prevLen = curLen;
    }

    // Scroll to trigger lazy-loaded content
    if (scroll) {
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(500);
    }

    const extracted = await page.evaluate((): {
      title: string;
      description: string;
      headings: CapturedHeading[];
      links: CapturedLink[];
      content: string;
    } => {
      const remove = document.querySelectorAll(
        'script, style, nav[aria-label="Footer"], [role="complementary"]',
      );
      remove.forEach((el) => el.remove());

      const title = document.title;
      const description =
        (document.querySelector(
          'meta[name="description"]',
        ) as HTMLMetaElement | null)?.content ||
        (document.querySelector(
          'meta[property="og:description"]',
        ) as HTMLMetaElement | null)?.content ||
        "";
      const headings = Array.from(
        document.querySelectorAll("h1, h2, h3"),
        (el) => ({
          level: el.tagName,
          text: (el as HTMLElement).innerText.trim(),
        }),
      ).filter((h) => h.text.length > 0);
      const links = Array.from(
        document.querySelectorAll("a[href]"),
        (el) => ({
          text: (el as HTMLElement).innerText.trim(),
          href: (el as HTMLAnchorElement).href,
        }),
      )
        .filter((l) => l.text.length > 0 && l.href.startsWith("http"))
        .slice(0, 50);
      const content = document.body.innerText;

      return { title, description, headings, links, content };
    });

    if (extracted.content.length > MAX_CONTENT_LENGTH) {
      extracted.content = extracted.content.slice(0, MAX_CONTENT_LENGTH);
    }

    return {
      title: extracted.title,
      description: extracted.description,
      headings: extracted.headings,
      links: extracted.links,
      content: extracted.content,
      url,
      capturedAt: new Date().toISOString(),
    };
  } catch (err) {
    // If page interaction fails, browser may be dead
    const message = getErrorMessage(err);
    if (message.includes("Target closed") || message.includes("Browser closed")) {
      browserPromise = null;
    }
    throw err;
  } finally {
    activeCaptures--;
    await page?.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b) await b.close().catch(() => {});
    browserPromise = null;
  }
}
