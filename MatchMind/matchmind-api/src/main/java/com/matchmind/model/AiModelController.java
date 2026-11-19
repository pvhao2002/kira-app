package com.matchmind.model;

import com.matchmind.model.AiModelService.ModelView;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Read-only: a model is created the first time an agent sends a prediction with it (X-Model-Name). */
@RestController
@RequestMapping("/api/v1/models")
@RequiredArgsConstructor
@Tag(name = "AI models")
public class AiModelController {
    private final AiModelService service;

    @GetMapping
    public List<ModelView> list(@RequestParam(required = false) UUID providerId) {
        return service.list(providerId);
    }

    @GetMapping("/{id}")
    public ModelView get(@PathVariable UUID id) {
        return service.get(id);
    }
}
