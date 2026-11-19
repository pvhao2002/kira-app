package com.matchmind.shared;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Writes a header + rows table as CSV (UTF-8 with BOM) or as a minimal single-sheet XLSX (Office Open XML).
 * No spreadsheet library is needed for plain tabular exports.
 */
public final class TableExport {
    private TableExport() {
    }

    public static ResponseEntity<byte[]> download(String format, String baseName, List<String> header,
                                                  List<List<Object>> rows) {
        boolean xlsx = "xlsx".equalsIgnoreCase(format);
        byte[] body = xlsx ? xlsx(header, rows) : csv(header, rows);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + baseName + (xlsx ? ".xlsx\"" : ".csv\""))
            .contentType(xlsx
                ? MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                : new MediaType("text", "csv", StandardCharsets.UTF_8))
            .body(body);
    }

    static byte[] csv(List<String> header, List<List<Object>> rows) {
        StringBuilder out = new StringBuilder("﻿");
        csvRow(out, List.copyOf(header));
        rows.forEach(r -> csvRow(out, r));
        return out.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static void csvRow(StringBuilder out, List<?> cells) {
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) out.append(',');
            Object v = cells.get(i);
            if (v == null) continue;
            String text = v.toString();
            // Spreadsheet formula injection: neutralise text cells a spreadsheet would evaluate.
            if (!(v instanceof Number) && !text.isEmpty() && "=+-@\t\r".indexOf(text.charAt(0)) >= 0) text = "'" + text;
            out.append('"').append(text.replace("\"", "\"\"")).append('"');
        }
        out.append("\r\n");
    }

    static byte[] xlsx(List<String> header, List<List<Object>> rows) {
        StringBuilder sheet = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
            + "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
        xlsxRow(sheet, 1, List.copyOf(header));
        for (int i = 0; i < rows.size(); i++) xlsxRow(sheet, i + 2, rows.get(i));
        sheet.append("</sheetData></worksheet>");
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            entry(zip, "[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
                + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
                + "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
                + "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>"
                + "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>"
                + "</Types>");
            entry(zip, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>"
                + "</Relationships>");
            entry(zip, "xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                + "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" "
                + "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">"
                + "<sheets><sheet name=\"Report\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
            entry(zip, "xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>"
                + "</Relationships>");
            entry(zip, "xl/worksheets/sheet1.xml", sheet.toString());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }

    private static void xlsxRow(StringBuilder out, int row, List<?> cells) {
        out.append("<row r=\"").append(row).append("\">");
        for (Object v : cells) {
            if (v == null) {
                out.append("<c/>");
            } else if (v instanceof Number n) {
                out.append("<c><v>").append(n).append("</v></c>");
            } else {
                out.append("<c t=\"inlineStr\"><is><t xml:space=\"preserve\">").append(escapeXml(v.toString()))
                    .append("</t></is></c>");
            }
        }
        out.append("</row>");
    }

    static String escapeXml(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            switch (c) {
                case '&' -> b.append("&amp;");
                case '<' -> b.append("&lt;");
                case '>' -> b.append("&gt;");
                case '"' -> b.append("&quot;");
                default -> {
                    // XML 1.0 forbids most control characters.
                    if (c >= 0x20 || c == '\t' || c == '\n' || c == '\r') b.append(c);
                }
            }
        }
        return b.toString();
    }

    private static void entry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
