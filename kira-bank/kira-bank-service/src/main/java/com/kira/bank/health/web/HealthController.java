package com.kira.bank.health.web;

import com.kira.bank.health.application.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import static com.kira.bank.health.application.HealthDtos.*;

@RestController
@RequestMapping("/api/v1/health")
@RequiredArgsConstructor
public class HealthController {
    private final HealthService service;
    private final HealthAiService ai;
    @GetMapping("/profile") public ProfileView profile(@AuthenticationPrincipal Long u) { return service.profile(u); }
    @PutMapping("/profile") public ProfileView profile(@AuthenticationPrincipal Long u,@Valid @RequestBody ProfileWrite p) { return service.saveProfile(u,p); }
    @GetMapping("/weights") public List<Weight> weights(@AuthenticationPrincipal Long u) { return service.weights(u); }
    @PutMapping("/weights") public void weight(@AuthenticationPrincipal Long u,@Valid @RequestBody Weight p) { service.weight(u,p); }
    @DeleteMapping("/weights/{date}") public void weight(@AuthenticationPrincipal Long u,@PathVariable LocalDate date) { service.deleteWeight(u,date); }
    @GetMapping("/summary") public Summary summary(@AuthenticationPrincipal Long u,@RequestParam LocalDate date) { return service.summary(u,date); }
    @GetMapping("/statistics") public List<Summary> statistics(@AuthenticationPrincipal Long u,@RequestParam LocalDate from,@RequestParam LocalDate to) { return service.statistics(u,from,to); }
    @GetMapping("/plans") public List<PlanView> plans(@AuthenticationPrincipal Long u,@RequestParam LocalDate weekStart) { return service.plans(u,weekStart); }
    @PostMapping("/plans") public PlanView createPlan(@AuthenticationPrincipal Long u,@Valid @RequestBody PlanWrite p) { return service.savePlan(u,null,p); }
    @PutMapping("/plans/{id}") public PlanView updatePlan(@AuthenticationPrincipal Long u,@PathVariable String id,@Valid @RequestBody PlanWrite p) { return service.savePlan(u,id,p); }
    @PostMapping("/plans/{id}/approve") public PlanView approve(@AuthenticationPrincipal Long u,@PathVariable String id,@Valid @RequestBody Approval p) { return service.approve(u,id,p); }
    @PutMapping("/plans/{id}/items/{index}/completion") public PlanView complete(@AuthenticationPrincipal Long u,@PathVariable String id,@PathVariable int index,@RequestParam long version,@RequestParam boolean completed) { return service.complete(u,id,index,version,completed); }
    @GetMapping("/journals") public List<JournalView> journals(@AuthenticationPrincipal Long u,@RequestParam LocalDate from,@RequestParam LocalDate to) { return service.journals(u,from,to); }
    @PostMapping("/journals") public JournalView journal(@AuthenticationPrincipal Long u,@Valid @RequestBody JournalWrite p) { return service.journal(u,null,p); }
    @PutMapping("/journals/{id}") public JournalView journal(@AuthenticationPrincipal Long u,@PathVariable String id,@Valid @RequestBody JournalWrite p) { return service.journal(u,id,p); }
    @DeleteMapping("/journals/{id}") public void deleteJournal(@AuthenticationPrincipal Long u,@PathVariable String id,@RequestParam long version) { service.deleteJournal(u,id,version); }
    @GetMapping("/connection") public Device connection(@AuthenticationPrincipal Long u) { return service.device(u); }
    @PostMapping("/connection") public Device connect(@AuthenticationPrincipal Long u,@Valid @RequestBody Connect c) { return service.connect(u,c); }
    @DeleteMapping("/connection") public void disconnect(@AuthenticationPrincipal Long u,@RequestParam(defaultValue="false") boolean deleteData) { service.disconnect(u,deleteData); }
    @PostMapping("/sync") public Device sync(@AuthenticationPrincipal Long u,@Valid @RequestBody Sync s) { return service.sync(u,s); }
    @PostMapping("/ai-jobs") public AiJob generate(@AuthenticationPrincipal Long u,@Valid @RequestBody AiRequest r) { return ai.generate(u,r); }
    @GetMapping("/ai-jobs") public List<AiJob> jobs(@AuthenticationPrincipal Long u) { return ai.jobs(u); }
}
