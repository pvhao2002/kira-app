package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.InvestmentAccount;
import com.kira.bank.investment.infrastructure.InvestmentAccountRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.kira.bank.investment.application.InvestmentDtos.AccountResponse;
import static com.kira.bank.investment.application.InvestmentDtos.CreateAccountRequest;
import static com.kira.bank.investment.application.InvestmentDtos.UpdateAccountRequest;
import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@Service
@RequiredArgsConstructor
public class InvestmentService {
    private final InvestmentAccountRepository accounts;

    @Transactional
    public AccountResponse createAccount(Long userId, CreateAccountRequest request) {
        InvestmentAccount account = new InvestmentAccount();
        account.setUserId(userId);
        account.setAccountCode(request.accountCode());
        account.setAccountName(request.accountName());
        account.setAccountUsername(request.accountUsername());
        account.setAccountEmail(request.accountEmail());
        account.setPhoneNumber(request.phoneNumber());
        account.setRegisterDate(request.registerDate());
        account.setAccountPassword(request.accountPassword());
        account.setCurrency(request.currency() == null ? "VND" : request.currency());
        return dto(accounts.save(account));
    }

    @Transactional(readOnly = true)
    public PageResponse<AccountResponse> accounts(Long userId, String search, Pageable pageable) {
        Page<AccountResponse> page = accounts.search(
            userId,
            search == null ? "" : search.trim(),
            pageable
        ).map(this::dto);
        return new PageResponse<>(page.getContent(),
            new PageMeta(page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @Transactional(readOnly = true)
    public AccountResponse accountDetails(Long userId, Long id) {
        return dto(account(id, userId));
    }

    @Transactional
    public AccountResponse updateAccount(Long userId, Long id, UpdateAccountRequest request) {
        InvestmentAccount account = account(id, userId);
        if (account.getVersion() != request.version()) {
            throw new ApiException(HttpStatus.CONFLICT, "ACCOUNT_VERSION_CONFLICT",
                "Dữ liệu tài khoản đã được cập nhật ở phiên khác");
        }
        if (!java.util.Set.of("ACTIVE", "INACTIVE", "CLOSED").contains(request.status())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_ACCOUNT_STATUS",
                "Trạng thái tài khoản không hợp lệ");
        }
        account.setAccountCode(request.accountCode());
        account.setAccountName(request.accountName());
        account.setExternalAccountCode(request.externalAccountCode());
        account.setAccountUsername(request.accountUsername());
        account.setAccountEmail(request.accountEmail());
        account.setPhoneNumber(request.phoneNumber());
        account.setRegisterDate(request.registerDate());
        account.setAccountPassword(request.accountPassword());
        account.setStatus(request.status());
        account.setNote(request.note());
        return dto(accounts.save(account));
    }

    private InvestmentAccount account(Long id, Long userId) {
        return accounts.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVESTMENT_ACCOUNT_NOT_FOUND",
                "Không tìm thấy dữ liệu"));
    }

    private AccountResponse dto(InvestmentAccount account) {
        return new AccountResponse(
            account.getId(), account.getAccountCode(), account.getAccountName(), account.getExternalAccountCode(),
            account.getAccountUsername(), account.getAccountEmail(), account.getPhoneNumber(), account.getRegisterDate(),
            account.getAccountPassword(), account.getCurrency(), account.getStatus(), account.getNote(),
            account.getVersion()
        );
    }
}
