package com.kira.bank.publiccatalog.web;

import com.kira.bank.publiccatalog.application.CatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicCatalogController {
    private final CatalogService service;

    @GetMapping("/banks")
    Object banks(@RequestParam(defaultValue = "") String search,
                 @PageableDefault(size = 20, sort = "name") Pageable p) {
        return service.banks(search, p);
    }

    @GetMapping("/banks/{id}")
    Object bank(@PathVariable long id) {
        return service.bank(id);
    }

}
