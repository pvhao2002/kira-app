package com.kira.news.article;

import com.kira.news.identity.CurrentUser;
import com.kira.news.proto.v1.*;
import com.kira.news.shared.Protobuf;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = "/api/v1/admin/articles", produces = Protobuf.CONTENT_TYPE)
public class AdminArticleController {
    private final AdminArticleService service;

    public AdminArticleController(AdminArticleService service) {
        this.service = service;
    }

    @GetMapping
    public AdminArticlePage list(@RequestParam(defaultValue = "ARTICLE_STATUS_UNSPECIFIED") com.kira.news.proto.v1.ArticleStatus status,
                                 @RequestParam(defaultValue = "") String q,
                                 @RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "20") int size) {
        return service.list(status, q, page, size);
    }

    @GetMapping("/{id}")
    public AdminArticle get(@PathVariable long id, @AuthenticationPrincipal CurrentUser user) {
        return service.get(id, user);
    }

    @PostMapping(consumes = Protobuf.CONTENT_TYPE)
    public AdminArticle create(@RequestBody ArticleDraft draft, @AuthenticationPrincipal CurrentUser user) {
        return service.create(draft, user);
    }

    @PutMapping(path = "/{id}", consumes = Protobuf.CONTENT_TYPE)
    public AdminArticle update(@PathVariable long id, @RequestBody ArticleDraft draft,
                               @AuthenticationPrincipal CurrentUser user) {
        return service.update(id, draft, user);
    }

    @PostMapping(path = "/{id}/transitions", consumes = Protobuf.CONTENT_TYPE)
    public AdminArticle transition(@PathVariable long id, @RequestBody TransitionRequest request,
                                   @AuthenticationPrincipal CurrentUser user) {
        return service.transition(id, request, user);
    }

    @PostMapping(path = "/{id}/comments", consumes = Protobuf.CONTENT_TYPE)
    public AdminArticle comment(@PathVariable long id, @RequestBody CommentRequest request,
                                @AuthenticationPrincipal CurrentUser user) {
        return service.comment(id, request, user);
    }

    @PostMapping(path = "/{id}/comments/{commentId}/resolve", consumes = Protobuf.CONTENT_TYPE)
    public AdminArticle resolve(@PathVariable long id, @PathVariable long commentId,
                                @RequestBody ResolveCommentRequest request, @AuthenticationPrincipal CurrentUser user) {
        return service.resolveComment(id, commentId, request, user);
    }

    @GetMapping("/{id}/revisions/{revision}")
    public Revision revision(@PathVariable long id, @PathVariable int revision) {
        return service.revision(id, revision);
    }
}
