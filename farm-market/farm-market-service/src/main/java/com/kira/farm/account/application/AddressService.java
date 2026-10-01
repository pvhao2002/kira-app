package com.kira.farm.account.application;

import com.kira.farm.account.domain.Address;
import com.kira.farm.account.infrastructure.AddressRepository;
import com.kira.farm.branch.domain.Branch;
import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

import static com.kira.farm.account.application.AccountDtos.*;

/** A customer's saved addresses. Every query is scoped to the authenticated user. Never log address contents. */
@Service
@RequiredArgsConstructor
public class AddressService {
    static final int MAX_ADDRESSES = 20;

    private final AddressRepository addresses;
    private final BranchRepository branches;

    @Transactional(readOnly = true)
    public List<AddressResponse> list() {
        return addresses.findByUserIdOrderByDefaultAddressDescIdDesc(CurrentUser.id()).stream()
            .map(AddressResponse::of).toList();
    }

    @Transactional
    public AddressResponse create(AddressRequest r) {
        Long userId = CurrentUser.id();
        long count = addresses.countByUserId(userId);
        if (count >= MAX_ADDRESSES)
            throw ApiException.unprocessable("ADDRESS_LIMIT", "Bạn chỉ có thể lưu tối đa " + MAX_ADDRESSES + " địa chỉ");
        Address a = new Address();
        a.setUserId(userId);
        apply(a, r);
        a.setDefaultAddress(count == 0);
        Long id = addresses.saveAndFlush(a).getId();
        if (r.makeDefault() && count > 0) return AddressResponse.of(markDefault(userId, id));
        return AddressResponse.of(addresses.findById(id).orElseThrow());
    }

    @Transactional
    public AddressResponse update(Long id, AddressRequest r) {
        Long userId = CurrentUser.id();
        Address a = owned(id, userId);
        apply(a, r);
        addresses.saveAndFlush(a);
        return AddressResponse.of(r.makeDefault() ? markDefault(userId, id) : owned(id, userId));
    }

    @Transactional
    public AddressResponse setDefault(Long id) {
        Long userId = CurrentUser.id();
        owned(id, userId);
        return AddressResponse.of(markDefault(userId, id));
    }

    /** Deleting the default promotes the most recently added remaining address. */
    @Transactional
    public void delete(Long id) {
        Long userId = CurrentUser.id();
        Address a = owned(id, userId);
        boolean wasDefault = a.isDefaultAddress();
        addresses.delete(a);
        addresses.flush();
        if (wasDefault) addresses.findFirstByUserIdOrderByIdDesc(userId).ifPresent(next -> markDefault(userId, next.getId()));
    }

    private Address markDefault(Long userId, Long id) {
        addresses.clearDefault(userId);
        Address a = owned(id, userId);
        a.setDefaultAddress(true);
        return addresses.saveAndFlush(a);
    }

    private Address owned(Long id, Long userId) {
        return addresses.findByIdAndUserId(id, userId)
            .orElseThrow(() -> ApiException.notFound("ADDRESS_NOT_FOUND", "Không tìm thấy địa chỉ"));
    }

    private void apply(Address a, AddressRequest r) {
        a.setLabel(r.label().trim());
        a.setRecipient(r.recipient().trim());
        a.setPhone(r.phone().trim());
        a.setLine1(r.line1().trim());
        a.setWard(blankToNull(r.ward()));
        a.setDistrict(blankToNull(r.district()));
        a.setCity(blankToNull(r.city()));
        a.setLatitude(r.latitude());
        a.setLongitude(r.longitude());
        a.setNearestBranchId(resolveBranch(r));
    }

    private Long resolveBranch(AddressRequest r) {
        if (r.nearestBranchId() != null) {
            if (!branches.existsById(r.nearestBranchId()))
                throw ApiException.badRequest("BRANCH_NOT_FOUND", "Chi nhánh không tồn tại");
            return r.nearestBranchId();
        }
        // ponytail: text match of district then city against the branch name/address; use coordinates (haversine)
        // once branches expose latitude/longitude in the entity.
        List<Branch> all = branches.findAllByOrderByIdAsc();
        for (String needle : new String[]{r.district(), r.city()}) {
            String n = needle == null ? "" : needle.trim().toLowerCase(Locale.ROOT);
            if (n.isEmpty()) continue;
            for (Branch b : all)
                if ((b.getName() + " " + b.getAddress()).toLowerCase(Locale.ROOT).contains(n)) return b.getId();
        }
        return null;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
