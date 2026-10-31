package com.kira.news;

import com.google.protobuf.Message;
import com.google.protobuf.Parser;
import com.kira.news.proto.v1.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.oracle.OracleContainer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The whole AI-draft → review → publish → read loop against a real Oracle database, over protobuf. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@TestPropertySource(properties = {
        "news.bootstrap.admin.username=owner", "news.bootstrap.admin.password=owner-password-123",
        "news.bootstrap.editor.username=codex", "news.bootstrap.editor.password=codex-password-123",
        "news.site-url=https://news.example.com"})
class NewsFlowIT {
    private static final String PROTO = "application/x-protobuf";

    @Container
    @ServiceConnection
    static OracleContainer oracle = new OracleContainer("gvenzl/oracle-free:23-slim-faststart");

    @Autowired
    MockMvc mvc;

    @Test
    void aiDraftReviewPublishAndReadLoop() throws Exception {
        // anonymous users cannot reach the admin API
        mvc.perform(get("/api/v1/admin/articles").accept(PROTO)).andExpect(status().isUnauthorized());

        var codex = login("codex", "codex-password-123");
        var owner = login("owner", "owner-password-123");

        var categories = call(get("/api/v1/public/categories"), null, CategoryList.parser());
        var tech = categories.getItemsList().stream().filter(c -> c.getSlug().equals("cong-nghe")).findFirst().orElseThrow();

        // 1. AI creates and submits a draft
        var created = call(post("/api/v1/admin/articles"), codex, AdminArticle.parser(), ArticleDraft.newBuilder()
                .setTitle("Việt Nam ra mắt mô hình AI tiếng Việt mã nguồn mở")
                .setSummary("Mô hình mới hỗ trợ tốt tiếng Việt và được công bố miễn phí.")
                .setBodyMarkdown("## Bối cảnh\n\nMột nhóm nghiên cứu vừa công bố mô hình ngôn ngữ lớn cho tiếng Việt.\n\n<script>x</script>")
                .setCategoryId(tech.getId())
                .addTags("AI").addSourceUrls("https://example.org/ai-vn")
                .build());
        assertThat(created.getStatus()).isEqualTo(ArticleStatus.DRAFT);
        assertThat(created.getDraft().getSlug()).isEqualTo("viet-nam-ra-mat-mo-hinh-ai-tieng-viet-ma-nguon-mo");
        assertThat(created.getBodyHtml()).doesNotContain("<script>");
        assertThat(created.getAllowedActionsList()).containsExactly(WorkflowAction.SUBMIT);
        var id = created.getId();

        var submitted = transition(codex, id, WorkflowAction.SUBMIT, created.getDraft().getVersion(), "");
        assertThat(submitted.getStatus()).isEqualTo(ArticleStatus.IN_REVIEW);
        assertThat(submitted.getEditable()).isFalse();

        // the AI account cannot publish its own article
        mvc.perform(post("/api/v1/admin/articles/" + id + "/transitions").session(codex).with(csrf())
                        .contentType(PROTO).accept(PROTO)
                        .content(TransitionRequest.newBuilder().setAction(WorkflowAction.PUBLISH)
                                .setVersion(submitted.getDraft().getVersion()).build().toByteArray()))
                .andExpect(status().isConflict());

        // 2. Owner asks for changes with a comment
        var changes = transition(owner, id, WorkflowAction.REQUEST_CHANGES, submitted.getDraft().getVersion(),
                "Thêm số liệu về số tham số của mô hình.");
        assertThat(changes.getStatus()).isEqualTo(ArticleStatus.CHANGES_REQUESTED);
        var comment = changes.getComments(0);

        // 3. AI cannot resubmit until the comment is handled
        mvc.perform(post("/api/v1/admin/articles/" + id + "/transitions").session(codex).with(csrf())
                        .contentType(PROTO).accept(PROTO)
                        .content(TransitionRequest.newBuilder().setAction(WorkflowAction.SUBMIT)
                                .setVersion(changes.getDraft().getVersion()).build().toByteArray()))
                .andExpect(status().isBadRequest());

        var edited = call(put("/api/v1/admin/articles/" + id), codex, AdminArticle.parser(), changes.getDraft().toBuilder()
                .setBodyMarkdown(changes.getDraft().getBodyMarkdown() + "\n\nMô hình có 8 tỷ tham số.").build());
        assertThat(edited.getRevision()).isEqualTo(2);
        assertThat(edited.getRevisionsCount()).isEqualTo(2);
        // an all-default message (no note) is a zero-byte body: must still be accepted
        var resolved = call(post("/api/v1/admin/articles/" + id + "/comments/" + comment.getId() + "/resolve"), codex,
                AdminArticle.parser(), ResolveCommentRequest.getDefaultInstance());
        var resubmitted = transition(codex, id, WorkflowAction.SUBMIT, resolved.getDraft().getVersion(), "");
        assertThat(resubmitted.getStatus()).isEqualTo(ArticleStatus.IN_REVIEW);

        // 4. Owner publishes
        var published = transition(owner, id, WorkflowAction.PUBLISH, resubmitted.getDraft().getVersion(), "");
        assertThat(published.getStatus()).isEqualTo(ArticleStatus.PUBLISHED);
        assertThat(published.getPublishedAt()).isPositive();

        // 5. Public site sees it; a read with ipinfo data is stored and counted once per visitor
        var detail = call(get("/api/v1/public/articles/" + published.getDraft().getSlug()), null, ArticleDetail.parser());
        assertThat(detail.getBodyHtml()).contains("8 tỷ tham số");
        var home = call(get("/api/v1/public/home"), null, HomePage.parser());
        assertThat(home.getLead().getId()).isEqualTo(id);
        assertThat(call(get("/api/v1/public/search?q=tiếng việt"), null, ArticlePage.parser()).getTotal()).isEqualTo(1);

        var read = ReadEvent.newBuilder().setArticleId(id).setVisitorId("visitor-0001").setSessionId("session-0001")
                .setIpInfo(IpInfo.newBuilder().setIp("113.161.1.1").setCity("Hanoi").setCountry("VN").setOrg("AS45899 VNPT"))
                .setLanguage("vi-VN").setScreenWidth(390).setScreenHeight(844).build();
        for (var i = 0; i < 2; i++) {
            mvc.perform(post("/api/v1/public/reads").contentType(PROTO).content(read.toByteArray()))
                    .andExpect(status().isNoContent());
        }
        var dashboard = call(get("/api/v1/admin/dashboard"), owner, Dashboard.parser());
        assertThat(dashboard.getReadsToday()).isEqualTo(2);
        assertThat(dashboard.getVisitors7D()).isEqualTo(1);
        assertThat(dashboard.getTopCountries(0).getCountry()).isEqualTo("VN");
        assertThat(dashboard.getReadsByDayList()).hasSize(1);
        assertThat(dashboard.getTopArticles(0).getViewCount()).isEqualTo(1);
        var reads = call(get("/api/v1/admin/reads"), owner, ReadPage.parser());
        assertThat(reads.getItems(0).getIpInfo().getCity()).isEqualTo("Hanoi");

        // regression: an admin edit of a published article keeps its public URL and does not reset the view count
        var current = call(get("/api/v1/admin/articles/" + id), owner, AdminArticle.parser());
        var retitled = call(put("/api/v1/admin/articles/" + id), owner, AdminArticle.parser(),
                current.getDraft().toBuilder().setTitle("Tiêu đề đã sửa lỗi chính tả").setSlug("").build());
        assertThat(retitled.getDraft().getSlug()).isEqualTo(published.getDraft().getSlug());
        assertThat(retitled.getViewCount()).isEqualTo(1);

        // regression: long Vietnamese comments fit (CLOB), malformed protobuf is a 400 not a 500
        call(post("/api/v1/admin/articles/" + id + "/comments"), owner, AdminArticle.parser(),
                CommentRequest.newBuilder().setBody("Góp ý tiếng Việt rất dài ".repeat(150)).build());
        mvc.perform(post("/api/v1/public/reads").contentType(PROTO).content(new byte[]{(byte) 0xff, 0x01}))
                .andExpect(status().isBadRequest());

        // the AI account cannot read analytics
        mvc.perform(get("/api/v1/admin/dashboard").session(codex).accept(PROTO)).andExpect(status().isForbidden());

        // 6. Crawler files
        mvc.perform(get("/news-sitemap.xml")).andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "https://news.example.com/tin/" + published.getDraft().getSlug())));
        mvc.perform(get("/robots.txt")).andExpect(content().string(org.hamcrest.Matchers.containsString("Disallow: /admin")));
    }

    private MockHttpSession login(String username, String password) throws Exception {
        var result = mvc.perform(post("/api/v1/auth/login").with(csrf()).contentType(PROTO).accept(PROTO)
                        .content(LoginRequest.newBuilder().setUsername(username).setPassword(password).build().toByteArray()))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(Me.parseFrom(result.getResponse().getContentAsByteArray()).getUsername()).isEqualTo(username);
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private AdminArticle transition(MockHttpSession session, long id, WorkflowAction action, long version, String note)
            throws Exception {
        return call(post("/api/v1/admin/articles/" + id + "/transitions"), session, AdminArticle.parser(),
                TransitionRequest.newBuilder().setAction(action).setVersion(version).setNote(note).build());
    }

    private <T> T call(MockHttpServletRequestBuilder request, MockHttpSession session, Parser<T> parser) throws Exception {
        return call(request, session, parser, null);
    }

    private <T> T call(MockHttpServletRequestBuilder request, MockHttpSession session, Parser<T> parser, Message body)
            throws Exception {
        request.accept(PROTO);
        if (session != null) {
            request.session(session).with(csrf());
        }
        if (body != null) {
            request.contentType(PROTO).content(body.toByteArray());
        }
        var response = mvc.perform(request).andReturn().getResponse();
        var bytes = response.getContentAsByteArray();
        assertThat(response.getStatus()).as("%s", response.getStatus() == 200 ? "" : ApiError.parseFrom(bytes)).isEqualTo(200);
        assertThat(response.getContentType()).startsWith(PROTO);
        return parser.parseFrom(bytes);
    }
}
