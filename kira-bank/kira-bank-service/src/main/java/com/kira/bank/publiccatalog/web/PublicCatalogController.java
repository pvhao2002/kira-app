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

    @GetMapping("/mccs")
    Object mccs(@RequestParam(defaultValue = "") String search,
                @RequestParam(defaultValue = "") String category,
                @PageableDefault(size = 20, sort = "code") Pageable p) {
        return service.mccs(search, category, p);
    }

    @GetMapping("/mccs/{id}")
    Object mcc(@PathVariable long id) {
        return service.mcc(id);
    }
}
