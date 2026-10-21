package com.kira.bank.english.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.ai.AiJsonClient;
import com.kira.bank.english.application.EnglishDtos.*;
import com.kira.bank.english.infrastructure.EnglishRewriteRepository;
import com.kira.bank.identity.application.UsageQuotaService;
import com.kira.bank.shared.web.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EnglishRewriteServiceTest {
    static final ObjectMapper M = new ObjectMapper();
    static final String OK = "{\"title\":\"Daily update\",\"sentences\":[{\"section\":\"Yesterday\",\"en\":\"I fixed the currency bug.\",\"vi\":\"Tôi đã sửa bug tiền tệ.\"}],\"keyPhrases\":[]}";
    @Mock
    EnglishRewriteRepository repo;
    @Mock
    AiJsonClient ai;
    @Mock
    UsageQuotaService quota;
    @InjectMocks
    EnglishRewriteService service;

    static JsonNode json(String s) {
        try {
            return M.readTree(s);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static void code(String code, Runnable r) {
        assertEquals(code, assertThrows(ApiException.class, r::run).getCode());
    }

    @Test
    void rejectsBlankNotesWithoutConsumingQuota() {
        code("ENGLISH_NOTES_INVALID", () -> service.create(7L, new RewriteRequest(Kind.STANDUP, "   ", null, null)));
        code("ENGLISH_NOTES_INVALID", () -> service.create(7L, new RewriteRequest(Kind.STANDUP, "a".repeat(4001), null, null)));
        verifyNoInteractions(quota, ai);
    }

    @Test
    void interviewNeedsQuestion() {
        code("ENGLISH_QUESTION_REQUIRED", () -> service.create(7L, new RewriteRequest(Kind.INTERVIEW, "notes", null, null)));
        verifyNoInteractions(quota, ai);
    }

    @Test
    void createsAndSavesValidRewrite() {
        when(ai.generate(anyString(), any(), eq("ENGLISH"))).thenReturn(json(OK));
        var r = service.create(7L, new RewriteRequest(Kind.STANDUP, " notes ", null, null));
        assertEquals("Daily update", r.title());
        assertEquals(1, r.sentences().size());
        verify(quota).consumeAi(7L, 1);
        verify(repo).insert(eq(7L), anyString(), any(), any());
        verify(quota, never()).refundAi(anyLong(), anyInt());
    }

    @Test
    void providerInputHasNoIdentity() {
        when(ai.generate(anyString(), any(), eq("ENGLISH"))).thenReturn(json(OK));
        service.create(7L, new RewriteRequest(Kind.STANDUP, "notes", null, null));
        var cap = ArgumentCaptor.forClass(Object.class);
        verify(ai).generate(anyString(), cap.capture(), eq("ENGLISH"));
        assertInstanceOf(Map.class, cap.getValue());
        assertEquals(Set.of("kind", "category", "question", "notes"), ((Map<?, ?>) cap.getValue()).keySet());
    }

    @Test
    void refundsQuotaWhenProviderFails() {
        when(ai.generate(anyString(), any(), eq("ENGLISH"))).thenThrow(new IllegalStateException("ENGLISH_AI_UNAVAILABLE"));
        var req = new RewriteRequest(Kind.STANDUP, "notes", null, null);
        var ex = assertThrows(ApiException.class, () -> service.create(7L, req));
        assertEquals("ENGLISH_AI_UNAVAILABLE", ex.getCode());
        assertEquals(503, ex.getStatus().value());
        verify(quota).refundAi(7L, 1);
        verify(repo, never()).insert(anyLong(), any(), any(), any());
    }

    @Test
    void notConfiguredIs503AndRefunds() {
        when(ai.generate(anyString(), any(), eq("ENGLISH"))).thenThrow(new IllegalStateException("ENGLISH_AI_NOT_CONFIGURED"));
        var req = new RewriteRequest(Kind.STANDUP, "n", null, null);
        var ex = assertThrows(ApiException.class, () -> service.create(7L, req));
        assertEquals("ENGLISH_AI_NOT_CONFIGURED", ex.getCode());
        assertEquals(503, ex.getStatus().value());
        verify(quota).refundAi(7L, 1);
    }

    @Test
    void rejectsNonConformingResponse() {
        String s41 = "{\"title\":\"t\",\"sentences\":[" + String.join(",", Collections.nCopies(41, "{\"en\":\"x\"}")) + "]}";
        String long401 = "{\"title\":\"t\",\"sentences\":[{\"en\":\"" + "a".repeat(401) + "\"}]}";
        String k9 = "{\"title\":\"t\",\"sentences\":[{\"en\":\"x\"}],\"keyPhrases\":[" + String.join(",", Collections.nCopies(9, "{\"en\":\"x\"}")) + "]}";
        for (String bad : new String[]{"{\"sentences\":[]}", s41, long401, k9})
            code("ENGLISH_AI_INVALID_RESPONSE", () -> EnglishRewriteService.validate(json(bad)));
        when(ai.generate(anyString(), any(), eq("ENGLISH"))).thenReturn(json("{\"sentences\":[]}"));
        var req = new RewriteRequest(Kind.STANDUP, "n", null, null);
        var ex = assertThrows(ApiException.class, () -> service.create(7L, req));
        assertEquals(502, ex.getStatus().value());
        verify(quota).refundAi(7L, 1);
        verify(repo, never()).insert(anyLong(), any(), any(), any());
    }

    @Test
    void nonInterviewIgnoresQuestionAndCategory() {
        when(ai.generate(anyString(), any(), eq("ENGLISH"))).thenReturn(json(OK));
        var r = service.create(7L, new RewriteRequest(Kind.STANDUP, "notes", "q".repeat(600), Category.SPRING));
        assertNull(r.question());
        assertNull(r.category());
        var cap = ArgumentCaptor.forClass(Object.class);
        verify(ai).generate(anyString(), cap.capture(), eq("ENGLISH"));
        var input = (Map<?, ?>) cap.getValue();
        assertNull(input.get("question"));
        assertNull(input.get("category"));
    }

    @Test
    void refundsQuotaWhenInsertFails() {
        when(ai.generate(anyString(), any(), eq("ENGLISH"))).thenReturn(json(OK));
        doThrow(new IllegalStateException("db")).when(repo).insert(anyLong(), any(), any(), any());
        var req = new RewriteRequest(Kind.STANDUP, "notes", null, null);
        assertThrows(IllegalStateException.class, () -> service.create(7L, req));
        verify(quota, times(1)).refundAi(7L, 1);
    }

    @Test
    void truncatesLongTitle() {
        var r = EnglishRewriteService.validate(json("{\"title\":\"" + "t".repeat(120) + "\",\"sentences\":[{\"en\":\"x\"}]}"));
        assertEquals(80, r.title().length());
    }

    @Test
    void foreignRewriteIsNotFound() {
        when(repo.find(7L, "x")).thenReturn(Optional.empty());
        when(repo.delete(7L, "x")).thenReturn(false);
        code("ENGLISH_REWRITE_NOT_FOUND", () -> service.get(7L, "x"));
        code("ENGLISH_REWRITE_NOT_FOUND", () -> service.delete(7L, "x"));
    }
}
