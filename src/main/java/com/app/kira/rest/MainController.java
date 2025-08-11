package com.app.kira.rest;

import com.app.kira.model.*;
import com.app.kira.util.DateUtil;
import com.app.kira.util.PlaywrightUtil;
import com.google.gson.Gson;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.pdf.PdfWriter;
import com.microsoft.playwright.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.core.io.InputStreamResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.util.CollectionUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.URL;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Log
@RestController
@RequiredArgsConstructor
public class MainController {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final Gson gson = new Gson();
    private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

    private final String PROMPT = """
            I will provide a list of upcoming football matches below.
            For each match, please predict the result and provide betting recommendations for the following markets:
            – Asian Handicap
            – 1X2 (European odds)
            – Over/Under Goals
            – Over/Under Corners
            – Over/Under Cards
                        
            Base your analysis on current form, head-to-head record, team news, and tactical trends. If detailed data is not available, use probability and general patterns.
                        
            Matches:
                        
            %s
            …
                        
            For each match, please present your answer in this format:
                        
            Score prediction:
                        
            Asian Handicap pick:
                        
            1X2 pick:
                        
            Over/Under Goals pick:
                        
            Over/Under Corners pick:
                        
            Over/Under Cards pick:
                        
            Reasoning:
            """;
    RestTemplate restTemplate = new RestTemplate();

    @GetMapping("testss")
    public String test() {
        log.log(Level.INFO, "Last day of month: {0}", "1234");
        return "Test successful";
    }

    @GetMapping("/last-days")
    public List<LocalDate> getLastDaysOfMonths(
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate fromDate) {
        String TOKEN = "Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIyIiwianRpIjoiMiIsImlhdCI6MTc1NDgxMDg4OCwiZXhwIjoxNzU0ODU0MDg4fQ.SAeY6MjsXHIc1wZnqWMC6vLqgkXsAhqN5ZE2YyNPVowxd2y-IR1k_YrizUcoKkQbbJdo1ma9aUHdoj03KMXG2g";
        List<LocalDate> lastDays = new ArrayList<>();

        // toDate luôn là thời điểm hiện tại
        LocalDate toDate = LocalDate.now();

        if (fromDate.isAfter(toDate)) {
            throw new IllegalArgumentException("fromDate phải nhỏ hơn hoặc bằng thời điểm hiện tại");
        }

        YearMonth start = YearMonth.from(fromDate);
        YearMonth end = YearMonth.from(toDate);

        YearMonth current = start;
        while (!current.isAfter(end)) {
            LocalDate lastDay = current.atEndOfMonth();
            if (!lastDay.isBefore(fromDate) && !lastDay.isAfter(toDate)) {
                lastDays.add(lastDay);
                log.log(Level.INFO, "Last day of month: {0}", lastDay);
                String API1 = UriComponentsBuilder.fromHttpUrl("https://sb11.safari77.com/aqs-agent-service/test/record-balance")
                        .queryParam("requestDate", lastDay)
                        .toUriString();
                String API2 = UriComponentsBuilder.fromUriString("https://sb11.safari77.com/aqs-scheduler/journal/ct-cje")
                        .queryParam("companyId", "1")
                        .queryParam("date", lastDay)
                        .toUriString();
                String API3 = UriComponentsBuilder.fromUriString("https://sb11.safari77.com/aqs-scheduler/journal/ct-cje")
                        .queryParam("companyId", "4")
                        .queryParam("date", lastDay)
                        .toUriString();
                String API4 = UriComponentsBuilder.fromUriString("https://sb11.safari77.com/aqs-scheduler/journal/closing-journal-ignore-gen")
                        .queryParam("date", lastDay)
                        .toUriString();

                var listApi = List.of(API1, API2, API3, API4);
                for (String api : listApi) {
                    try {
                        log.log(Level.INFO, "API: {0}", api);
                        HttpHeaders headers = new HttpHeaders();
                        headers.set("Authorization", TOKEN);
                        headers.setContentType(MediaType.APPLICATION_JSON);
                        HttpEntity<Void> entity = new HttpEntity<>(headers);

                        ResponseEntity<?> response = restTemplate.exchange(
                                api,
                                HttpMethod.GET,
                                entity,
                                Object.class
                        );

                        var bd = response.getBody();
                        log.log(Level.INFO, "Response: {0}", bd);
                        Thread.sleep(3000);
                    } catch (Exception e) {
                        log.log(Level.WARNING, "Error calling API: ", e);
                    }
                }
            }
            current = current.plusMonths(1);
        }

        return lastDays;
    }


    @GetMapping("check-playwright")
    public Object checkPlayWright(@RequestParam String url) {
        log.info("Checking Playwright...");
        AtomicReference<String> doc = new AtomicReference<>();
        PlaywrightUtil.withPlaywright(Collections.emptyList(), true, (page, list) -> {
            page.navigate(url, new Page.NavigateOptions().setTimeout(30_000));
            page.waitForTimeout(2_000);
            var pageSource = page.content();
            var document = Jsoup.parse(pageSource, url);
            // remove script tags
            document.select("script").remove();
            doc.set(document.html());
        });
        return doc.get();
    }

    @GetMapping(value = "under", produces = MediaType.TEXT_PLAIN_VALUE)
    public Object under(@RequestParam(required = false, defaultValue = "1") String mode) {
        var events = getEvents("");
        return events.stream()
                .filter(it -> List.of("2.25", "2/2.5").contains(Optional.ofNullable(it.getOddsGoal())
                        .filter(odds -> !odds.isEmpty())
                        .map(List::getFirst)
                        .map(OddGoal::getGoals)
                        .orElse("null")))
                .collect(Collectors.collectingAndThen(
                        Collectors.toList(),
                        list -> "Tổng số event: " + list.size() + "\n" +
                                list.stream()
                                        .map(it -> "1".equalsIgnoreCase(mode) ? it.toResultUnder() : it.toResult(true))
                                        .collect(Collectors.joining("\n"))
                ));
    }

    @GetMapping(value = "current", produces = MediaType.TEXT_PLAIN_VALUE)
    public Object current(
            @RequestParam(value = "league_name", defaultValue = "") String leagueName,
            @RequestParam(value = "showOdd", required = false) Boolean showOdd
    ) {
        return getEvents(leagueName)
                .stream()
                .collect(Collectors.collectingAndThen(
                        Collectors.toList(),
                        list -> "Tổng số event: " + list.size() + "\n" +
                                list.stream()
                                        .map(it -> it.toResult(true))
                                        .collect(Collectors.joining("\n"))
                ));
    }

    @GetMapping(value = "new-predict", produces = MediaType.TEXT_PLAIN_VALUE)
    public Object newPredict(
            @RequestParam(value = "league_name", defaultValue = "") String leagueName
    ) {
        return getEvents(leagueName)
                .stream()
                .collect(Collectors.collectingAndThen(
                        Collectors.toList(),
                        list -> "Tổng số event: " + list.size() + "\n" +
                                PROMPT.formatted(
                                        IntStream.range(0, list.size())
                                                .mapToObj(i -> list.get(i).toResult(i + 1))
                                                .collect(Collectors.joining("\n"))
                                ) + "\n\n"
                ));
    }

    private List<EventResult> getEvents(String leagueName) {
        var sql = """
                SELECT e.event_id,
                       e.event_name,
                       e.event_date,
                       e.league_name,
                       o.odd_type,
                       o.odd_value
                FROM events e
                         LEFT JOIN odds o ON e.event_id = o.event_id
                WHERE e.event_date BETWEEN :start_date AND :end_date
                   AND e.league_name LIKE :league_name
                ORDER BY e.event_date
                """;
        var startDate = DateUtil.currentDateNow();
        var endDate = DateUtil.next7Days();
        var param = new MapSqlParameterSource()
                .addValue("start_date", startDate)
                .addValue("end_date", endDate)
                .addValue("league_name", "%" + leagueName + "%");
        return jdbcTemplate.query(sql, param, (rs, i) -> new EventDTO(rs))
                .stream()
                .collect(Collectors.groupingBy(EventDTO::getEventId))
                .entrySet()
                .stream()
                .map(EventResult::new)
                .sorted(Comparator.comparing(EventResult::getEventDate))
                .toList();
    }

    @GetMapping("league")
    public Object getLeagues(@RequestParam(value = "day", defaultValue = "today") String day) {
        var sql = """
                select league_name, MIN(event_date) AS event_date
                from events
                WHERE event_date BETWEEN
                          CASE
                              WHEN :day = 'today' THEN CONCAT('2025-06-05', ' 00:00:00')
                              WHEN :day = 'tomorrow' THEN CONCAT(DATE_ADD('2025-06-05', INTERVAL 1 DAY), ' 00:00:00')
                              END
                          AND
                          CASE
                              WHEN :day = 'today' THEN CONCAT('2025-06-05', ' 23:59:59')
                              WHEN :day = 'tomorrow' THEN CONCAT(DATE_ADD('2025-06-05', INTERVAL 1 DAY), ' 23:59:59')
                              END
                GROUP BY league_name
                HAVING event_date > DATE_ADD(NOW(), INTERVAL 7 HOUR)
                ORDER BY event_date
                """;
        var param = new MapSqlParameterSource()
                .addValue("day", day);
        return jdbcTemplate.query(
                sql,
                param,
                (rs, i) -> new String[]{rs.getString("league_name"), rs.getString("event_date")}
        );
    }

    @GetMapping("/generate-pdf")
    public Object generatePdf(@RequestParam String url) throws Exception {
        List<String> imageLinks = new CopyOnWriteArrayList<>();
        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true));
            BrowserContext context = browser.newContext();
            Page page = context.newPage();

            // Lắng nghe network request
            page.onRequestFinished(request -> {
                String u = request.url();
                if (u.startsWith("https://drive.google.com/viewerng/img")) {
                    System.out.println("Found image link: " + u);
                    imageLinks.add(u);
                }
            });

            // Mở trang
            page.navigate(url);
            page.waitForTimeout(3000);

            for (int i = 0; i < 430; i++) {
                if (imageLinks.size() == 192) {
                    break; // Dừng nếu đã đủ 192 ảnh
                }
                System.out.println("Crawl time: " + i + ", number of images: " + imageLinks.size());
                page.evaluate("""
                        () => {
                            const scroller = document.querySelector('.ndfHFb-c4YZDc-cYSp0e-s2gQvd, .ndfHFb-c4YZDc-s2gQvd, .ndfHFb-c4YZDc-s2gQvd-sn54Q') || document.scrollingElement;
                            if (scroller) {
                                scroller.scrollBy(0, 800);
                            }
                        }
                        """);
                page.waitForTimeout(300);
            }
            System.out.println("Số ảnh tìm thấy: " + imageLinks.size());
            // Đóng trình duyệt
            browser.close();
        }
        // Sắp xếp theo param page
        List<String> sortedLinks = imageLinks.stream()
                .sorted(Comparator.comparingInt(link -> {
                    Matcher matcher = Pattern.compile("[?&]page=(\\d+)").matcher(link);
                    return matcher.find() ? Integer.parseInt(matcher.group(1)) : 0;
                }))
                .toList();
        System.out.println("Số ảnh sau khi sắp xếp: " + sortedLinks.size());
        ImageIO.scanForPlugins();
        // Tạo PDF
        String outputPath = "images_output.pdf";
        try (FileOutputStream fos = new FileOutputStream(outputPath)) {
            com.lowagie.text.Document document = new com.lowagie.text.Document();
            PdfWriter.getInstance(document, fos);
            document.open();

            for (String imgUrl : sortedLinks) {
                try (InputStream in = new URL(imgUrl).openStream()) {
                    BufferedImage img = ImageIO.read(in);
                    if (img != null) {
                        byte[] compressedBytes = compressJpeg(img, 0.5f); // 50% quality
                        Image pdfImg = Image.getInstance(compressedBytes);
                        pdfImg.scaleToFit(PageSize.A4.getWidth(), PageSize.A4.getHeight());
                        pdfImg.setAlignment(Image.ALIGN_CENTER);
                        document.add(pdfImg);
                        document.newPage();
                    } else {
                        System.err.println("Image is null: " + imgUrl);
                    }
                } catch (Exception e) {
                    System.err.println("Failed to load image: " + imgUrl);
                }
            }

            document.close();
        }

        // Trả về file
        File file = new File(outputPath);
        InputStreamResource resource = new InputStreamResource(new FileInputStream(file));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment;filename=" + file.getName())
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(file.length())
                .body(resource);
    }

    public byte[] compressJpeg(BufferedImage image, float quality) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        ImageWriter jpgWriter = ImageIO.getImageWritersByFormatName("jpg").next();
        ImageWriteParam jpgWriteParam = jpgWriter.getDefaultWriteParam();
        jpgWriteParam.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        jpgWriteParam.setCompressionQuality(quality); // từ 0.0 (thấp nhất) đến 1.0 (cao nhất)

        ImageOutputStream ios = ImageIO.createImageOutputStream(baos);
        jpgWriter.setOutput(ios);
        jpgWriter.write(null, new IIOImage(image, null, null), jpgWriteParam);

        jpgWriter.dispose();
        return baos.toByteArray();
    }
}
