package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.InvestmentAccount;
import com.kira.bank.investment.infrastructure.InvestmentAccountRepository;
import com.kira.bank.investment.infrastructure.InvestmentCredentialCipher;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.kira.bank.investment.application.InvestmentDtos.*;
import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@Service
@RequiredArgsConstructor
public class InvestmentService {
    private final InvestmentAccountRepository accounts;
    private final InvestmentCredentialCipher credentialCipher;

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
        account.setAccountPassword(encryptNewPassword(request.accountPassword()));
        account.setCurrency(request.currency() == null ? "VND" : request.currency());
        return dto(accounts.save(account));
    }

    @Transactional
    public PageResponse<AccountResponse> accounts(Long userId, String search, Pageable pageable) {
        Page<AccountResponse> page = accounts.search(
            userId,
            search == null ? "" : search.trim(),
            pageable
        ).map(account -> {
            if (protectLegacyPassword(account)) {
                accounts.saveAndFlush(account);
            }
            return dto(account);
        });
        return new PageResponse<>(page.getContent(),
            new PageMeta(page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @Transactional
    public AccountResponse accountDetails(Long userId, Long id) {
        InvestmentAccount account = account(id, userId);
        if (protectLegacyPassword(account)) {
            accounts.saveAndFlush(account);
        }
        return dto(account);
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
        account.setAccountUsername(request.accountUsername());
        account.setAccountEmail(request.accountEmail());
        account.setPhoneNumber(request.phoneNumber());
        account.setRegisterDate(request.registerDate());
        if (request.accountPassword() != null && !request.accountPassword().isBlank()) {
            account.setAccountPassword(encryptNewPassword(request.accountPassword()));
        } else {
            protectLegacyPassword(account);
        }
        account.setStatus(request.status());
        account.setNote(request.note());
        return dto(accounts.saveAndFlush(account));
    }

    private InvestmentAccount account(Long id, Long userId) {
        return accounts.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVESTMENT_ACCOUNT_NOT_FOUND",
                "Không tìm thấy dữ liệu"));
    }

    private AccountResponse dto(InvestmentAccount account) {
        return new AccountResponse(
            account.getId(), account.getAccountCode(), account.getAccountName(), account.getAccountUsername(),
            account.getAccountEmail(), account.getPhoneNumber(), account.getRegisterDate(),
            account.getAccountPassword() != null && !account.getAccountPassword().isBlank(), account.getCurrency(), account.getStatus(), account.getNote(),
            account.getVersion()
        );
    }

    private String encryptNewPassword(String password) {
        if (!credentialCipher.isConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "INVESTMENT_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED",
                "Khóa mã hóa mật khẩu tài khoản đầu tư chưa được cấu hình");
        }
        return credentialCipher.encrypt(password.trim());
    }

    private boolean protectLegacyPassword(InvestmentAccount account) {
        String password = account.getAccountPassword();
        if (password == null || password.isBlank() || credentialCipher.isCiphertext(password)
            || !credentialCipher.isConfigured()) {
            return false;
        }
        account.setAccountPassword(credentialCipher.encrypt(password));
        return true;
    }
}
