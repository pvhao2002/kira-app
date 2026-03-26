/**
 * 1) npm install
 * 2) npx playwright install chromium   (trên đúng kiến trúc CPU: arm64 / x64)
 * 3) npm start
 *
 * Nếu Playwright báo thiếu binary: đặt USE_SYSTEM_CHROME=1 để dùng Google Chrome đã cài (macOS/Windows).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");
const SERIES_URL = "https://yourhomework.net/quiz/series/00003044";
const USE_SYSTEM_CHROME = process.env.USE_SYSTEM_CHROME === "1";

function sanitizeFileName(name) {
  return (
    name
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200) || "homework"
  );
}

async function collectExerciseLinks(page) {
  return page.$$eval(
    ".order-1.order-sm-1.order-md-1 ol li",
    (lis) => {
      const urls = [];
      for (const li of lis) {
        const a = li.querySelector("a[href]");
        if (!a) continue;
        try {
          urls.push(new URL(a.getAttribute("href"), window.location.href).href);
        } catch {
          urls.push(a.href);
        }
      }
      return urls;
    }
  );
}

async function stripBodyToBlogPost(page) {
  await page.evaluate(() => {
    const blogPost = document.querySelector(".blog-post");
    if (!blogPost) {
      throw new Error("Không tìm thấy .blog-post trên trang");
    }
    const titleEl = document.querySelector("#quiztitsp");
    const node = blogPost.cloneNode(true);
    document.body.innerHTML = "";

    if (titleEl) {
      const titleWrapper = document.createElement("div");
      titleWrapper.style.marginBottom = "12px";
      titleWrapper.style.fontWeight = "700";
      titleWrapper.style.fontSize = "22px";
      titleWrapper.innerHTML = titleEl.innerHTML;
      document.body.appendChild(titleWrapper);
    }

    document.body.appendChild(node);
  });
}

async function prepareImagesForPdf(page) {
  await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));

    for (const img of imgs) {
      const candidateSrc =
        img.getAttribute("src") ||
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("data-lazy-src") ||
        img.getAttribute("data-url");

      if (!candidateSrc) continue;

      try {
        const absoluteSrc = new URL(candidateSrc, window.location.href).href;
        if (img.getAttribute("src") !== absoluteSrc) {
          img.setAttribute("src", absoluteSrc);
        }
      } catch {
        img.setAttribute("src", candidateSrc);
      }
    }
  });

  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      })
    );
  });
}

async function removeTrailingArtifacts(page) {
  await page.evaluate(() => {
    const blogPost = document.querySelector(".blog-post");
    if (!blogPost) return;

    const isRemovableTailNode = (el) => {
      const text = (el.textContent || "").replace(/\u00a0/g, " ").trim();
      const media = el.querySelector("img, video, iframe, canvas, svg, table");
      const hasFormControl = el.querySelector("input, textarea, select, button");

      if (hasFormControl) return false;

      if (media) {
        const imgs = Array.from(el.querySelectorAll("img"));
        const hasLoadedImage = imgs.some((img) => img.naturalWidth > 0);
        if (hasLoadedImage) return false;
      }

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const looksLikePlaceholder =
        rect.height >= 60 &&
        style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        style.backgroundColor !== "transparent";

      return text.length === 0 && (looksLikePlaceholder || !media);
    };

    let guard = 0;
    while (blogPost.lastElementChild && guard < 20) {
      const last = blogPost.lastElementChild;
      if (!isRemovableTailNode(last)) break;
      last.remove();
      guard += 1;
    }
  });
}

async function compactLayoutForPdf(page) {
  await page.addStyleTag({
    content: `
      @page { size: A4; margin: 8mm; }
      html, body {
        font-size: 13px !important;
        line-height: 1.25 !important;
      }
      #quiztitsp, body > div:first-child {
        margin: 0 0 8px 0 !important;
        font-size: 18px !important;
        line-height: 1.2 !important;
      }
      .blog-post, .blog-post * {
        box-sizing: border-box !important;
      }
      .blog-post p,
      .blog-post li,
      .blog-post div {
        margin-top: 0.25rem !important;
        margin-bottom: 0.25rem !important;
        line-height: 1.25 !important;
      }
      .blog-post h1, .blog-post h2, .blog-post h3, .blog-post h4 {
        margin-top: 0.35rem !important;
        margin-bottom: 0.25rem !important;
        line-height: 1.2 !important;
      }
      .blog-post img {
        max-width: 100% !important;
        height: auto !important;
      }
      .blog-post br + br {
        display: none !important;
      }
      .blog-post .mb-5, .blog-post .mt-5, .blog-post .py-5, .blog-post .my-5 {
        margin-top: 0.4rem !important;
        margin-bottom: 0.4rem !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
      }
    `,
  });
}

async function getQuizTitle(page) {
  const el = page.locator("#quiztitsp").first();
  if ((await el.count()) === 0) {
    return "homework";
  }
  const text = (await el.textContent()) || "homework";
  return text.trim();
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    ...(USE_SYSTEM_CHROME ? { channel: "chrome" } : {}),
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Đang mở trang series:", SERIES_URL);
  await page.goto(SERIES_URL, { waitUntil: "networkidle", timeout: 120_000 });

  let hrefs = await collectExerciseLinks(page);
  hrefs = [...new Set(hrefs)];

  if (hrefs.length === 0) {
    console.warn(
      "Không tìm thấy link nào với .order-1.order-sm-1.order-md-1 ol li — kiểm tra selector hoặc đăng nhập."
    );
    await browser.close();
    process.exit(1);
  }

  console.log(`Tìm thấy ${hrefs.length} link bài tập.`);

  let index = 0;
  for (const url of hrefs) {
    index += 1;
    console.log(`[${index}/${hrefs.length}] ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForSelector(".blog-post", { timeout: 60_000 });
      await page.waitForSelector("#quiztitsp", { timeout: 30_000 }).catch(() => {});

      const titleText = await getQuizTitle(page);
      const baseName = sanitizeFileName(titleText);
      let pdfPath = path.join(OUTPUT_DIR, `${baseName}.pdf`);
      let n = 1;
      while (fs.existsSync(pdfPath)) {
        pdfPath = path.join(OUTPUT_DIR, `${baseName}-${n}.pdf`);
        n += 1;
      }

      await stripBodyToBlogPost(page);
      await prepareImagesForPdf(page);
      await removeTrailingArtifacts(page);
      await compactLayoutForPdf(page);

      await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        scale: 0.92,
        margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
      });

      console.log("  -> PDF:", pdfPath);
    } catch (err) {
      console.error("  Lỗi:", err.message);
    }
  }

  await browser.close();
  console.log("Xong. PDF trong thư mục:", OUTPUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
