import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");
const SERIES_URL = "https://yourhomework.net/quiz/series/00003044";
const USE_SYSTEM_CHROME = process.env.USE_SYSTEM_CHROME === "1";
const OUTPUT_FILE = process.env.OUTPUT_FILE || "series-all-in-one.pdf";

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
  return page.$$eval(".order-1.order-sm-1.order-md-1 ol li", (lis) => {
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
  });
}

function buildMergedHtml(units, seriesTitle) {
  const sectionsHtml = units
    .map(
      (unit, index) => `
      <section class="unit">
        <div class="unit-header">
          <div class="unit-index">Unit ${index + 1}</div>
          <h2 class="unit-title">${unit.titleHtml || unit.titleText}</h2>
        </div>
        <div class="unit-content">${unit.contentHtml}</div>
      </section>
    `
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${seriesTitle}</title>
        <style>
          @page { size: A4; margin: 8mm; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            font-size: 13px;
            line-height: 1.25;
            color: #111;
          }
          body {
            font-family: "Arial", sans-serif;
          }
          .doc-title {
            margin: 0 0 8px;
            font-size: 18px;
            line-height: 1.2;
            font-weight: 700;
          }
          .unit {
            margin: 0 0 10px;
            padding: 6px 0 8px;
            border-bottom: 1px solid #ddd;
            break-inside: auto;
          }
          .unit-header {
            margin: 0 0 6px;
          }
          .unit-index {
            font-size: 11px;
            color: #666;
            margin-bottom: 2px;
          }
          .unit-title {
            margin: 0;
            font-size: 16px;
            line-height: 1.2;
          }
          .unit-content p,
          .unit-content li,
          .unit-content div {
            margin-top: 0.2rem !important;
            margin-bottom: 0.2rem !important;
            line-height: 1.25 !important;
          }
          .unit-content h1,
          .unit-content h2,
          .unit-content h3,
          .unit-content h4 {
            margin-top: 0.35rem !important;
            margin-bottom: 0.2rem !important;
            line-height: 1.2 !important;
          }
          .unit-content img {
            max-width: 100% !important;
            height: auto !important;
            page-break-inside: avoid;
          }
          .unit-content br + br {
            display: none !important;
          }
          .unit-content .mb-5,
          .unit-content .mt-5,
          .unit-content .py-5,
          .unit-content .my-5 {
            margin-top: 0.3rem !important;
            margin-bottom: 0.3rem !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
          .unit-content *[style*="background"] {
            min-height: 0 !important;
          }
        </style>
      </head>
      <body>
        <h1 class="doc-title">${seriesTitle}</h1>
        ${sectionsHtml}
      </body>
    </html>
  `;
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

  const seriesTitle = sanitizeFileName((await page.title()) || "series");
  let hrefs = await collectExerciseLinks(page);
  hrefs = [...new Set(hrefs)];

  if (hrefs.length === 0) {
    console.warn("Không tìm thấy link unit trong series.");
    await browser.close();
    process.exit(1);
  }

  console.log(`Tìm thấy ${hrefs.length} unit. Đang scrape và gộp nội dung...`);

  const units = [];
  let index = 0;
  for (const url of hrefs) {
    index += 1;
    console.log(`[${index}/${hrefs.length}] ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForSelector(".blog-post", { timeout: 60_000 });
      await page.waitForSelector("#quiztitsp", { timeout: 30_000 }).catch(() => {});

      const unitData = await page.evaluate(() => {
        const titleEl = document.querySelector("#quiztitsp");
        const blogPost = document.querySelector(".blog-post");
        if (!blogPost) {
          throw new Error("Không tìm thấy .blog-post");
        }

        const node = blogPost.cloneNode(true);

        // Loại phần tử rác/placeholder ở cuối unit.
        const isRemovableTailNode = (el) => {
          const text = (el.textContent || "").replace(/\u00a0/g, " ").trim();
          const media = el.querySelector("img, video, iframe, canvas, svg, table");
          const hasFormControl = el.querySelector("input, textarea, select, button");

          if (hasFormControl) return false;
          if (media) return false;

          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const looksLikePlaceholder =
            rect.height >= 60 &&
            style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
            style.backgroundColor !== "transparent";

          return text.length === 0 && looksLikePlaceholder;
        };

        let guard = 0;
        while (node.lastElementChild && guard < 20) {
          const last = node.lastElementChild;
          if (!isRemovableTailNode(last)) break;
          last.remove();
          guard += 1;
        }

        for (const img of node.querySelectorAll("img")) {
          const candidateSrc =
            img.getAttribute("src") ||
            img.getAttribute("data-src") ||
            img.getAttribute("data-original") ||
            img.getAttribute("data-lazy-src") ||
            img.getAttribute("data-url");
          if (!candidateSrc) continue;
          try {
            img.setAttribute("src", new URL(candidateSrc, window.location.href).href);
          } catch {
            img.setAttribute("src", candidateSrc);
          }
        }

        return {
          titleText: (titleEl?.textContent || "homework").trim(),
          titleHtml: titleEl?.innerHTML || "",
          contentHtml: node.innerHTML,
        };
      });

      units.push(unitData);
    } catch (err) {
      console.error("  Bỏ qua unit lỗi:", err.message);
    }
  }

  if (units.length === 0) {
    console.error("Không scrape được unit nào.");
    await browser.close();
    process.exit(1);
  }

  const mergedHtml = buildMergedHtml(units, seriesTitle);
  await page.setContent(mergedHtml, { waitUntil: "domcontentloaded" });

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

  const outputPath = path.join(OUTPUT_DIR, sanitizeFileName(OUTPUT_FILE));
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    scale: 0.92,
  });

  console.log("Xong. PDF đã gộp:", outputPath);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
