package com.matchmind.it;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Swagger lives under /swagger/ (nginx lets only admins through, like /monitor/); the root paths are gone. */
class SwaggerIT extends IntegrationTestBase {

    private MockHttpServletResponse at(String path) throws Exception {
        return mvc.perform(get(path)).andReturn().getResponse();
    }

    @Test
    void swaggerUiAndTheOpenApiDocumentLiveUnderSwagger() throws Exception {
        MockHttpServletResponse docs = at("/swagger/v3/api-docs");
        assertThat(docs.getStatus()).isEqualTo(200);
        // A relative server: "Try it out" calls the origin the page came from (https behind the TLS proxy).
        assertThat(docs.getContentAsString()).contains("MatchMind API", "\"servers\":[{\"url\":\"/\"");

        MockHttpServletResponse ui = at("/swagger/index.html");
        assertThat(ui.getStatus()).isEqualTo(302);
        String target = ui.getRedirectedUrl();
        assertThat(target).startsWith("/swagger/");
        assertThat(at(target).getStatus()).isEqualTo(200);
        assertThat(at("/swagger/swagger-ui/swagger-initializer.js").getContentAsString()).contains("/swagger/v3/api-docs");
    }

    @Test
    void theOldRootPathsAreGone() throws Exception {
        assertThat(at("/v3/api-docs").getStatus()).isNotEqualTo(200);
        assertThat(at("/swagger-ui.html").getStatus()).isNotEqualTo(200);
    }
}
