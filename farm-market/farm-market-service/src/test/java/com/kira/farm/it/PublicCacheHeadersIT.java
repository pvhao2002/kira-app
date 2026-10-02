package com.kira.farm.it;

import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Public storefront reads are cacheable (short max-age + ETag revalidation); authenticated and /admin never are. */
class PublicCacheHeadersIT extends IntegrationTestBase {

    private static String cacheControl(Res r) {
        return String.valueOf(r.headers().getCacheControl());
    }

    @Test
    void publicReadsCarryCacheControlEtagAndVary() {
        long productId = newProduct(Q7, 33_000, 10);
        String slug = jdbc.queryForObject("SELECT slug FROM products WHERE id=?", String.class, productId);
        for (String path : new String[]{"/api/v1/branches", "/api/v1/categories", "/api/v1/products?size=12",
            "/api/v1/products/" + slug}) {
            Res r = api.get(path, null);
            assertEquals(200, r.status(), path);
            assertTrue(cacheControl(r).contains("public"), path + " -> " + cacheControl(r));
            assertTrue(cacheControl(r).contains("max-age="), path);
            assertTrue(cacheControl(r).contains("must-revalidate"), path);
            assertNotNull(r.headers().getETag(), path + " has an ETag");
            assertTrue(r.headers().getETag().startsWith("W/"), "weak ETag keeps gzip possible: " + r.headers().getETag());
            String vary = String.join(",", r.headers().getVary()).toLowerCase();
            assertTrue(vary.contains("origin") && vary.contains("accept-encoding"), path + " Vary: " + vary);
        }
        // product lists/details revalidate quickly (stock and prices move); branches/categories may live longer
        assertTrue(cacheControl(api.get("/api/v1/products/" + slug, null)).contains("max-age=10"));
        assertTrue(cacheControl(api.get("/api/v1/branches", null)).contains("max-age=60"));
    }

    @Test
    void conditionalRequestGetsNotModifiedUntilTheDataChanges() {
        long productId = newProduct(Q7, 41_000, 10);
        String slug = jdbc.queryForObject("SELECT slug FROM products WHERE id=?", String.class, productId);
        String path = "/api/v1/products/" + slug;
        Res first = api.get(path, null);
        String etag = first.headers().getETag();
        assertNotNull(etag);

        Res again = api.call(HttpMethod.GET, path, null, null, Map.of(HttpHeaders.IF_NONE_MATCH, etag));
        assertEquals(304, again.status());
        assertEquals(etag, again.headers().getETag());
        assertTrue(cacheControl(again).contains("public"));

        jdbc.update("UPDATE products SET price = 42000 WHERE id=?", productId);
        Res changed = api.call(HttpMethod.GET, path, null, null, Map.of(HttpHeaders.IF_NONE_MATCH, etag));
        assertEquals(200, changed.status(), "a price change must not be served as 304");
        assertNotEquals(etag, changed.headers().getETag());
        assertEquals(42_000, changed.json().path("product").path("price").asLong());
    }

    @Test
    void errorsAreNeverCachedPublicly() {
        Res missing = api.get("/api/v1/products/no-such-product-" + System.nanoTime(), null);
        assertEquals(404, missing.status());
        assertFalse(cacheControl(missing).contains("public"));
        assertNull(missing.headers().getETag());
    }

    @Test
    void authenticatedAndBackOfficeResponsesAreNotPubliclyCacheable() {
        var c = newCustomer();
        String admin = staffToken("ADMIN");
        for (var req : new String[][]{{"/api/v1/orders", c.token()}, {"/api/v1/wishlist", c.token()},
            {"/api/v1/loyalty/summary", c.token()}, {"/api/v1/admin/orders", admin},
            {"/api/v1/admin/inventory", admin}, {"/api/v1/admin/dashboard", admin},
            // even a normally public path must not be shared once the caller is identified
            {"/api/v1/products?size=12", c.token()}, {"/api/v1/branches", admin}}) {
            Res r = api.get(req[0], req[1]);
            assertEquals(200, r.status(), req[0]);
            assertFalse(cacheControl(r).contains("public"), req[0] + " -> " + cacheControl(r));
            assertTrue(cacheControl(r).contains("no-store"), req[0] + " -> " + cacheControl(r));
            assertNull(r.headers().getETag(), req[0]);
        }
    }
}
