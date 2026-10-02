package com.kira.farm.shared.infrastructure;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

import java.io.IOException;

/**
 * HTTP caching for the anonymous storefront reads only: branches, categories, the product list and one product.
 * Successful GET responses get {@code Cache-Control: public, max-age=N, must-revalidate} plus a weak ETag
 * (computed from the body by Spring's ShallowEtagHeaderFilter), so browsers/CDNs revalidate with If-None-Match and get
 * a 304 instead of the body. Prices and stock change, hence the short product max-age and must-revalidate.
 * Anything carrying an Authorization header, any non-GET, any error, and every other path (orders, wishlist, /admin...)
 * is untouched, so Spring Security's default {@code no-store} stays on authenticated responses.
 */
@Component
public class PublicCacheFilter extends OncePerRequestFilter {
    private final boolean enabled;
    private final String staticControl;
    private final String productControl;
    private final ShallowEtagHeaderFilter etag = new ShallowEtagHeaderFilter();

    {
        // Weak validators on purpose: Tomcat never gzips a response that carries a strong ETag.
        etag.setWriteWeakETag(true);
    }

    public PublicCacheFilter(@Value("${app.http-cache.enabled:true}") boolean enabled,
                             @Value("${app.http-cache.static-max-age-seconds:60}") long staticMaxAge,
                             @Value("${app.http-cache.product-max-age-seconds:10}") long productMaxAge) {
        this.enabled = enabled;
        this.staticControl = control(staticMaxAge);
        this.productControl = control(productMaxAge);
    }

    private static String control(long maxAge) {
        return "public, max-age=" + maxAge + ", must-revalidate";
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || !"GET".equals(request.getMethod()) || request.getHeader(HttpHeaders.AUTHORIZATION) != null
            || controlFor(request.getRequestURI()) == null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String control = controlFor(request.getRequestURI());
        // The ETag filter buffers the body, so the headers can still be set once the controller has answered.
        etag.doFilter(request, response, (rq, rs) -> {
            chain.doFilter(rq, rs);
            HttpServletResponse res = (HttpServletResponse) rs;
            if (res.getStatus() >= 200 && res.getStatus() < 300) {
                res.setHeader(HttpHeaders.CACHE_CONTROL, control);
                res.addHeader(HttpHeaders.VARY, HttpHeaders.ORIGIN);
                res.addHeader(HttpHeaders.VARY, HttpHeaders.ACCEPT_ENCODING);
            }
        });
    }

    /** Cache-Control for a cacheable public path, or null when the path must not be cached. */
    private String controlFor(String path) {
        if (path.equals("/api/v1/branches") || path.equals("/api/v1/categories")) return staticControl;
        if (path.equals("/api/v1/products") || path.matches("/api/v1/products/[^/]+")) return productControl;
        return null;
    }
}
