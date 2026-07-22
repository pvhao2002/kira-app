package com.kira.bank.publiccatalog.web;

import com.kira.bank.publiccatalog.application.CatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicCatalogController {
    private final CatalogService service;

    @GetMapping("/banks")
    Object banks(@RequestParam(defaultValue = "") String search, @PageableDefault(size = 20, sort = "name") Pageable p) {
        return service.banks(search, p);
    }

    @GetMapping("/banks/{id}")
    Object bank(@PathVariable long id) {
        return service.bank(id);
    }

    @GetMapping("/cards")
    Object cards(@RequestParam(defaultValue = "") String search, @PageableDefault(size = 20, sort = "cardName") Pageable p) {
        return service.cards(search, p);
    }

    @GetMapping("/cards/{id}")
    Object card(@PathVariable long id) {
        return service.card(id);
    }

    @GetMapping("/mccs")
    Object mccs(@RequestParam(defaultValue = "") String search, @RequestParam(defaultValue = "") String category, @PageableDefault(size = 20, sort = "code") Pageable p) {
        return service.mccs(search, category, p);
    }

    @GetMapping("/mccs/{id}")
    Object mcc(@PathVariable long id) {
        return service.mcc(id);
    }

    @GetMapping("/cashback-finder")
    Object finder(@RequestParam long mccId, @RequestParam BigDecimal amount) {
        return service.finder(mccId, amount);
    }
}
