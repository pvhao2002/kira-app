package com.matchmind.provider;

import com.matchmind.provider.ProviderService.ProviderView;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Read-only: providers are created by the first external call that names them in X-Provider. */
@RestController
@RequestMapping("/api/v1/providers")
@RequiredArgsConstructor
@Tag(name = "Providers")
public class ProviderController {
    private final ProviderService service;

    @GetMapping
    public List<ProviderView> list() {
        return service.list();
    }
}
