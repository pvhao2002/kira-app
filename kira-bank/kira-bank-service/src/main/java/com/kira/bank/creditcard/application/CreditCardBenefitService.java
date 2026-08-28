package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.domain.*;
import com.kira.bank.creditcard.infrastructure.*;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.kira.bank.creditcard.application.CreditCardBenefitDtos.*;

@Service
@RequiredArgsConstructor
public class CreditCardBenefitService {
    private final UserCreditCardRepository cards;
    private final UserCardCashbackConfigRepository configs;
    private final CreditCardCashbackProgramRepository programs;
    private final CreditCardCashbackRuleRepository rules;
    private final CreditCardCashbackRuleMccRepository mccs;

    @Transactional(readOnly = true)
    public List<CardBenefitResponse> benefits(Long userId) {
        List<UserCreditCard> userCards = cards.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId);
        if (userCards.isEmpty()) return List.of();

        List<Long> cardIds = userCards.stream().map(UserCreditCard::getId).toList();
        Map<Long, UserCardCashbackConfig> configByCard = configs.findByUserCardIdInAndDeletedAtIsNull(cardIds)
            .stream().collect(Collectors.toMap(UserCardCashbackConfig::getUserCardId, Function.identity()));
        List<CreditCardCashbackProgram> activePrograms =
            programs.findByUserCardIdInAndDeletedAtIsNullOrderByCreatedAtDesc(cardIds);
        List<Long> programIds = activePrograms.stream().map(CreditCardCashbackProgram::getId).toList();
        List<CreditCardCashbackRule> activeRules = programIds.isEmpty() ? List.of()
            : rules.findByProgramIdInAndDeletedAtIsNullOrderByProgramIdAscDisplayOrderAsc(programIds);
        List<Long> ruleIds = activeRules.stream().map(CreditCardCashbackRule::getId).toList();
        List<CreditCardCashbackRuleMcc> activeMccs = ruleIds.isEmpty() ? List.of()
            : mccs.findByRuleIdInAndDeletedAtIsNull(ruleIds);

        Map<Long, List<CreditCardCashbackProgram>> programsByCard = activePrograms.stream()
            .collect(Collectors.groupingBy(CreditCardCashbackProgram::getUserCardId, LinkedHashMap::new,
                Collectors.toList()));
        Map<Long, List<CreditCardCashbackRule>> rulesByProgram = activeRules.stream()
            .collect(Collectors.groupingBy(CreditCardCashbackRule::getProgramId, LinkedHashMap::new,
                Collectors.toList()));
        Map<Long, List<CreditCardCashbackRuleMcc>> mccsByRule = activeMccs.stream()
            .collect(Collectors.groupingBy(CreditCardCashbackRuleMcc::getRuleId, LinkedHashMap::new,
                Collectors.toList()));

        return userCards.stream().map(card -> response(card, configByCard.get(card.getId()),
            programsByCard.getOrDefault(card.getId(), List.of()), rulesByProgram, mccsByRule)).toList();
    }

    @Transactional
    public CardBenefitResponse updateMonthlyCap(Long userId, Long cardId, MonthlyCapRequest request) {
        UserCreditCard card = ownCard(userId, cardId);
        UserCardCashbackConfig config = configs.findByUserCardIdAndDeletedAtIsNull(cardId).orElse(null);
        if (config == null) {
            if (request.version() != null && request.version() != 0) throw configConflict();
            config = new UserCardCashbackConfig();
            config.setUserCardId(cardId);
            config.setCreatedBy(userId);
        } else {
            requireVersion(config.getVersion(), request.version(), "CASHBACK_CONFIG_VERSION_CONFLICT");
        }
        config.setMonthlyCashbackCap(request.monthlyCashbackCap());
        config.setUpdatedBy(userId);
        try {
            configs.saveAndFlush(config);
        } catch (ObjectOptimisticLockingFailureException | DataIntegrityViolationException ex) {
            throw configConflict();
        }
        return responseForCard(card, config);
    }

    @Transactional
    public CardBenefitResponse createProgram(Long userId, Long cardId, CashbackProgramRequest request) {
        UserCreditCard card = ownCard(userId, cardId);
        if (request.version() != null) throw bad("CASHBACK_PROGRAM_VERSION_NOT_ALLOWED", "Version không được gửi khi tạo chương trình");
        validateProgram(request, false);
        CreditCardCashbackProgram program = new CreditCardCashbackProgram();
        program.setUserCardId(cardId);
        program.setCreatedBy(userId);
        applyProgram(program, request, userId);
        programs.saveAndFlush(program);
        syncRules(program, request.groups(), userId, false);
        return responseForCard(card, configs.findByUserCardIdAndDeletedAtIsNull(cardId).orElse(null));
    }

    @Transactional
    public CardBenefitResponse updateProgram(Long userId, Long cardId, Long programId,
                                             CashbackProgramRequest request) {
        UserCreditCard card = ownCard(userId, cardId);
        CreditCardCashbackProgram program = ownProgram(cardId, programId);
        requireVersion(program.getVersion(), request.version(), "CASHBACK_PROGRAM_VERSION_CONFLICT");
        validateProgram(request, true);
        applyProgram(program, request, userId);
        try {
            programs.saveAndFlush(program);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw programConflict();
        }
        syncRules(program, request.groups(), userId, true);
        return responseForCard(card, configs.findByUserCardIdAndDeletedAtIsNull(cardId).orElse(null));
    }

    @Transactional
    public void deleteProgram(Long userId, Long cardId, Long programId, VersionRequest request) {
        ownCard(userId, cardId);
        CreditCardCashbackProgram program = ownProgram(cardId, programId);
        requireVersion(program.getVersion(), request.version(), "CASHBACK_PROGRAM_VERSION_CONFLICT");
        Instant now = Instant.now();
        program.setDeletedAt(now);
        program.setUpdatedBy(userId);
        List<CreditCardCashbackRule> programRules = rules.findByProgramIdAndDeletedAtIsNullOrderByDisplayOrderAsc(programId);
        List<Long> ruleIds = programRules.stream().map(CreditCardCashbackRule::getId).toList();
        List<CreditCardCashbackRuleMcc> programMccs = ruleIds.isEmpty() ? List.of() : mccs.findByRuleIdInAndDeletedAtIsNull(ruleIds);
        programRules.forEach(rule -> { rule.setDeletedAt(now); rule.setUpdatedBy(userId); });
        programMccs.forEach(mcc -> { mcc.setDeletedAt(now); mcc.setUpdatedBy(userId); });
        try {
            mccs.saveAll(programMccs);
            rules.saveAll(programRules);
            programs.saveAndFlush(program);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw programConflict();
        }
    }

    private void syncRules(CreditCardCashbackProgram program, List<CashbackRuleRequest> requested,
                           Long userId, boolean updating) {
        Map<Long, CreditCardCashbackRule> existing = rules.findByProgramIdAndDeletedAtIsNullOrderByDisplayOrderAsc(program.getId()).stream()
            .collect(Collectors.toMap(CreditCardCashbackRule::getId, Function.identity()));
        Set<Long> retained = new HashSet<>();
        Instant now = Instant.now();

        for (int order = 0; order < requested.size(); order++) {
            CashbackRuleRequest input = requested.get(order);
            CreditCardCashbackRule rule;
            if (input.id() == null) {
                if (input.version() != null) throw bad("CASHBACK_RULE_VERSION_NOT_ALLOWED", "Version không được gửi cho nhóm mới");
                rule = new CreditCardCashbackRule();
                rule.setProgramId(program.getId());
                rule.setCreatedBy(userId);
            } else {
                if (!updating) throw bad("CASHBACK_RULE_ID_NOT_ALLOWED", "ID nhóm không được gửi khi tạo chương trình");
                rule = existing.get(input.id());
                if (rule == null) throw missing();
                requireVersion(rule.getVersion(), input.version(), "CASHBACK_RULE_VERSION_CONFLICT");
                retained.add(rule.getId());
            }
            rule.setCategoryName(input.categoryName().trim());
            rule.setDisplayOrder(order);
            rule.setCashbackRate(input.cashbackRate());
            rule.setMaxCashbackAmount(input.maxCashbackAmount());
            rule.setUpdatedBy(userId);
            try {
                rules.saveAndFlush(rule);
            } catch (ObjectOptimisticLockingFailureException ex) {
                throw ruleConflict();
            }
            retained.add(rule.getId());
            syncMccs(rule, normalizeMccs(input.mccCodes()), userId, now);
        }

        List<CreditCardCashbackRule> removed = existing.values().stream()
            .filter(rule -> !retained.contains(rule.getId())).toList();
        if (!removed.isEmpty()) {
            List<Long> removedIds = removed.stream().map(CreditCardCashbackRule::getId).toList();
            List<CreditCardCashbackRuleMcc> removedMccs = mccs.findByRuleIdInAndDeletedAtIsNull(removedIds);
            removed.forEach(rule -> { rule.setDeletedAt(now); rule.setUpdatedBy(userId); });
            removedMccs.forEach(mcc -> { mcc.setDeletedAt(now); mcc.setUpdatedBy(userId); });
            mccs.saveAll(removedMccs);
            rules.saveAll(removed);
        }
    }

    private void syncMccs(CreditCardCashbackRule rule, List<String> requested, Long userId, Instant now) {
        Map<String, CreditCardCashbackRuleMcc> existing = mccs.findByRuleId(rule.getId()).stream()
            .collect(Collectors.toMap(CreditCardCashbackRuleMcc::getMccCode, Function.identity()));
        Set<String> retained = new HashSet<>();
        for (String code : requested) {
            CreditCardCashbackRuleMcc mcc = existing.get(code);
            if (mcc == null) {
                mcc = new CreditCardCashbackRuleMcc();
                mcc.setRuleId(rule.getId());
                mcc.setMccCode(code);
                mcc.setCreatedBy(userId);
            }
            mcc.setDeletedAt(null);
            mcc.setUpdatedBy(userId);
            mccs.save(mcc);
            retained.add(code);
        }
        existing.values().stream().filter(mcc -> mcc.getDeletedAt() == null && !retained.contains(mcc.getMccCode()))
            .forEach(mcc -> { mcc.setDeletedAt(now); mcc.setUpdatedBy(userId); mccs.save(mcc); });
    }

    private void validateProgram(CashbackProgramRequest request, boolean updating) {
        if (!validUrl(request.termsUrl())) throw bad("CASHBACK_TERMS_URL_INVALID", "Link điều khoản phải dùng HTTP hoặc HTTPS");
        Set<String> categories = new HashSet<>();
        Set<String> allMccs = new HashSet<>();
        for (CashbackRuleRequest group : request.groups()) {
            String category = group.categoryName().trim().toLowerCase(Locale.ROOT);
            if (!categories.add(category)) throw bad("CASHBACK_CATEGORY_DUPLICATE", "Tên nhóm danh mục không được trùng trong chương trình");
            for (String rawCode : group.mccCodes()) {
                String code = rawCode.trim();
                if (!allMccs.add(code)) throw bad("CASHBACK_MCC_DUPLICATE", "Một MCC chỉ được thuộc một nhóm trong cùng chương trình");
            }
            if (!updating && (group.id() != null || group.version() != null))
                throw bad("CASHBACK_RULE_ID_NOT_ALLOWED", "ID và version nhóm không được gửi khi tạo chương trình");
        }
    }

    private boolean validUrl(String value) {
        if (value == null || value.isBlank()) return true;
        try {
            URI uri = URI.create(value.trim());
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                && uri.getHost() != null;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private List<String> normalizeMccs(List<String> values) {
        return values.stream().map(String::trim).distinct().sorted().toList();
    }

    private void applyProgram(CreditCardCashbackProgram program, CashbackProgramRequest request, Long userId) {
        program.setName(request.name().trim());
        program.setNotes(blankToNull(request.notes()));
        program.setTermsUrl(blankToNull(request.termsUrl()));
        program.setActive(request.active());
        program.setUpdatedBy(userId);
    }

    private CardBenefitResponse responseForCard(UserCreditCard card, UserCardCashbackConfig config) {
        List<CreditCardCashbackProgram> cardPrograms =
            programs.findByUserCardIdInAndDeletedAtIsNullOrderByCreatedAtDesc(List.of(card.getId()));
        List<Long> programIds = cardPrograms.stream().map(CreditCardCashbackProgram::getId).toList();
        List<CreditCardCashbackRule> cardRules = programIds.isEmpty() ? List.of()
            : rules.findByProgramIdInAndDeletedAtIsNullOrderByProgramIdAscDisplayOrderAsc(programIds);
        List<Long> ruleIds = cardRules.stream().map(CreditCardCashbackRule::getId).toList();
        List<CreditCardCashbackRuleMcc> cardMccs = ruleIds.isEmpty() ? List.of()
            : mccs.findByRuleIdInAndDeletedAtIsNull(ruleIds);
        return response(card, config, cardPrograms,
            cardRules.stream().collect(Collectors.groupingBy(CreditCardCashbackRule::getProgramId)),
            cardMccs.stream().collect(Collectors.groupingBy(CreditCardCashbackRuleMcc::getRuleId)));
    }

    private CardBenefitResponse response(UserCreditCard card, UserCardCashbackConfig config,
                                         List<CreditCardCashbackProgram> cardPrograms,
                                         Map<Long, List<CreditCardCashbackRule>> rulesByProgram,
                                         Map<Long, List<CreditCardCashbackRuleMcc>> mccsByRule) {
        List<CashbackProgramResponse> programResponses = cardPrograms.stream().map(program ->
            new CashbackProgramResponse(program.getId(), program.getName(), program.getNotes(), program.getTermsUrl(),
                program.isActive(), program.getVersion(), rulesByProgram.getOrDefault(program.getId(), List.of()).stream()
                .map(rule -> new CashbackRuleResponse(rule.getId(), rule.getCategoryName(), rule.getCashbackRate(),
                    rule.getMaxCashbackAmount(), mccsByRule.getOrDefault(rule.getId(), List.of()).stream()
                    .map(CreditCardCashbackRuleMcc::getMccCode).sorted().toList(), rule.getVersion())).toList())).toList();
        return new CardBenefitResponse(card.getId(), card.getBank().getId(), card.getBank().getName(),
            card.getBank().getLogoUrl(), card.getCardType(), card.getNickname(), card.getLastFour(), card.getStatus(),
            card.getCurrency(), config == null ? null : config.getMonthlyCashbackCap(),
            config == null ? null : config.getVersion(), programResponses);
    }

    private UserCreditCard ownCard(Long userId, Long cardId) {
        return cards.findByIdAndUserIdAndDeletedAtIsNull(cardId, userId).orElseThrow(this::missing);
    }

    private CreditCardCashbackProgram ownProgram(Long cardId, Long programId) {
        return programs.findByIdAndUserCardIdAndDeletedAtIsNull(programId, cardId).orElseThrow(this::missing);
    }

    private void requireVersion(long actual, Long requested, String code) {
        if (requested == null || requested != actual) {
            throw new ApiException(HttpStatus.CONFLICT, code, "Dữ liệu ưu đãi đã được cập nhật, vui lòng tải lại");
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "CREDIT_CARD_BENEFIT_NOT_FOUND", "Không tìm thấy cấu hình ưu đãi thẻ");
    }

    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private ApiException configConflict() {
        return new ApiException(HttpStatus.CONFLICT, "CASHBACK_CONFIG_VERSION_CONFLICT", "Trần hoàn tiền đã được cập nhật, vui lòng tải lại");
    }

    private ApiException programConflict() {
        return new ApiException(HttpStatus.CONFLICT, "CASHBACK_PROGRAM_VERSION_CONFLICT", "Chương trình đã được cập nhật, vui lòng tải lại");
    }

    private ApiException ruleConflict() {
        return new ApiException(HttpStatus.CONFLICT, "CASHBACK_RULE_VERSION_CONFLICT", "Nhóm MCC đã được cập nhật, vui lòng tải lại");
    }
}
