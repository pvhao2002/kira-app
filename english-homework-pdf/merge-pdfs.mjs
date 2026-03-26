import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");
const MERGED_FILE = process.env.MERGED_FILE || "merged.pdf";
const mergedPath = path.join(OUTPUT_DIR, MERGED_FILE);

function getPdfFiles() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    throw new Error(`Không tìm thấy thư mục output: ${OUTPUT_DIR}`);
  }

  return fs
    .readdirSync(OUTPUT_DIR)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .filter((name) => name !== MERGED_FILE)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((name) => path.join(OUTPUT_DIR, name));
}

async function mergePdfs() {
  const pdfFiles = getPdfFiles();

  if (pdfFiles.length === 0) {
    console.warn("Không có file PDF nào để gộp trong thư mục output.");
    return;
  }

  const mergedPdf = await PDFDocument.create();

  for (const filePath of pdfFiles) {
    const bytes = fs.readFileSync(filePath);
    const srcPdf = await PDFDocument.load(bytes);
    const pageIndexes = srcPdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(srcPdf, pageIndexes);

    // Mỗi file nguồn luôn bắt đầu ở trang mới vì copy theo từng khối trang của file.
    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }

  const mergedBytes = await mergedPdf.save();
  fs.writeFileSync(mergedPath, mergedBytes);

  console.log(`Đã gộp ${pdfFiles.length} file thành: ${mergedPath}`);
}

mergePdfs().catch((err) => {
  console.error("Lỗi gộp PDF:", err.message);
  process.exit(1);
});
