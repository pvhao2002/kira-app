package com.kira.bank.identity.web;

import com.kira.bank.identity.infrastructure.JwtAuthenticationFilter;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.identity.application.JwtService;
import com.kira.bank.identity.infrastructure.SecurityConfig;
import com.kira.bank.publiccatalog.application.CatalogService;
import com.kira.bank.publiccatalog.web.PublicCatalogController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PublicCatalogController.class)
@org.springframework.context.annotation.Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class AuthSecurityTest {
    @Autowired
    MockMvc mvc;
    @MockitoBean
    JwtService jwtService;
    @MockitoBean
    UserRepository users;
    @MockitoBean
    CatalogService catalogService;

    @Test
    void personalApiRejectsGuest() throws Exception {
        mvc.perform(get("/api/v1/credit-cards")).andExpect(status().isForbidden());
    }
}
