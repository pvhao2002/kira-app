package com.matchmind.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.matchmind.security.Principals.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.AbstractJackson2HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import java.util.Set;

/**
 * Which AI model or provider made a prediction is for admins only. For every other signed-in user this removes those
 * fields, at any depth, from each JSON response, so no endpoint can leak them by forgetting a check.
 */
@RestControllerAdvice
@RequiredArgsConstructor
public class ViewerResponseFilter implements ResponseBodyAdvice<Object> {
    static final Set<String> HIDDEN = Set.of("model", "models", "modelId", "modelName", "modelKey", "modelVersion",
        "modelCount", "provider", "providerId", "providerName");

    private final ObjectMapper json;

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return AbstractJackson2HttpMessageConverter.class.isAssignableFrom(converterType);
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType contentType,
                                  Class<? extends HttpMessageConverter<?>> converterType, ServerHttpRequest request,
                                  ServerHttpResponse response) {
        if (body == null || !isViewer()) return body;
        JsonNode tree = json.valueToTree(body);
        strip(tree);
        return tree;
    }

    /** A signed-in user other than an admin; agents (provider keys) and anonymous calls are left alone. */
    static boolean isViewer() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof UserPrincipal u && !"ADMIN".equals(u.role());
    }

    static void strip(JsonNode node) {
        if (node instanceof ObjectNode o) o.remove(HIDDEN);
        node.forEach(ViewerResponseFilter::strip);
    }
}
