package com.kira.farm.shared.infrastructure;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

import java.io.IOException;
import java.util.regex.Pattern;

/**
 * HTTP caching for the anonymous storefront reads only: branches, categories, the product list, one product and
 * uploaded images ({@code /api/v1/files/<uuid>.ext}: immutable names, so a long max-age).
 * Successful GET responses get {@code Cache-Control: public, max-age=N, must-revalidate} plus a weak ETag
 * (computed from the body by Spring's ShallowEtagHeaderFilter), so browsers/CDNs revalidate with If-None-Match and get
 * a 304 instead of the body. Prices and stock change, hence the short product max-age and must-revalidate.
 * Images are the exception: {@code public, max-age=31536000, immutable}, no ETag (the body is not buffered).
 * Anything carrying an Authorization header, any non-GET, any error, and every other path (orders, wishlist, /admin...)
 * is untouched, so Spring Security's default {@code no-store} stays on authenticated responses.
 */
@Component
public class PublicCacheFilter extends OncePerRequestFilter {
    /**
     * Stored image names are random and never rewritten, so an image is immutable. The pattern is looser than
     * MediaService.NAME: MediaController answers 2xx only for a valid name, everything else is 404 and stays uncached.
     */
    private static final String FILES_CONTROL = "public, max-age=31536000, immutable";
    private static final Pattern FILE = Pattern.compile("/api/v1/files/[^/]+");
    private static final Pattern PRODUCT = Pattern.compile("/api/v1/products/[^/]+");

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
        String path = request.getRequestURI();
        String control = controlFor(path);
        if (control == FILES_CONTROL) {
            // Immutable images: skip the ETag filter so the (up to 5MB) body is streamed, not buffered and hashed.
            // Streaming commits the response, so the header goes on first and is dropped again on any non-2xx status.
            response.setHeader(HttpHeaders.CACHE_CONTROL, control);
            response.addHeader(HttpHeaders.VARY, HttpHeaders.ORIGIN);
            response.addHeader(HttpHeaders.VARY, HttpHeaders.ACCEPT_ENCODING);
            chain.doFilter(request, new HttpServletResponseWrapper(response) {
                @Override
                public void setStatus(int sc) {
                    if (sc < 200 || sc >= 300) setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
                    super.setStatus(sc);
                }

                @Override
                public void sendError(int sc) throws IOException {
                    setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
                    super.sendError(sc);
                }

                @Override
                public void sendError(int sc, String msg) throws IOException {
                    setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
                    super.sendError(sc, msg);
                }
            });
            return;
        }
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
        if (FILE.matcher(path).matches()) return FILES_CONTROL;
        if (path.equals("/api/v1/products") || PRODUCT.matcher(path).matches()) return productControl;
        return null;
    }
}
