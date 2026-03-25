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
    const node = blogPost.cloneNode(true);
    document.body.innerHTML = "";
    document.body.appendChild(node);
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

      await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
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
