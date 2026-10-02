package com.kira.farm.identity.infrastructure;

import com.kira.farm.identity.domain.Role;
import com.kira.farm.identity.domain.User;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.identity.application.UserName;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    /** The authenticated principal needs the branch assignments on every request: one join, no lazy trip. */
    @EntityGraph(attributePaths = "branchIds")
    Optional<User> findWithBranchesById(Long id);

    default User requireById(Long id) {
        return findById(id).orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "Không tìm thấy người dùng"));
    }

    /** Display names for a set of users in one statement (order lists, reviews, notes). */
    @Query("select new com.kira.farm.identity.application.UserName(u.id, u.fullName) from User u where u.id in :ids")
    List<UserName> findNames(@Param("ids") Collection<Long> ids);

    /** Row lock used to serialise one customer's checkouts and point spending. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findForUpdate(@Param("id") Long id);

    @Query("select u from User u where u.role in :roles and (lower(u.fullName) like :q or lower(u.email) like :q) "
        + "order by u.id desc")
    org.springframework.data.domain.Page<User> searchByRole(@Param("roles") java.util.Collection<Role> roles,
                                                            @Param("q") String q,
                                                            org.springframework.data.domain.Pageable pageable);

    /** Atomically advances the replay marker; 0 rows means the step was already used (or a concurrent request won). */
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.totpLastStep = :step where u.id = :id and (u.totpLastStep is null or u.totpLastStep < :step)")
    int advanceTotpStep(@Param("id") Long id, @Param("step") long step);

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByPhone(String phone);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByPhone(String phone);

    boolean existsByPhoneAndIdNot(String phone, Long id);
}
