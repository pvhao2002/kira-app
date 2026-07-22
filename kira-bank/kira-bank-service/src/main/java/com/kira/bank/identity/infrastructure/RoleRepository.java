package com.kira.bank.identity.infrastructure;
import com.kira.bank.identity.domain.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface RoleRepository extends JpaRepository<Role,Long> { Optional<Role> findByName(String name); }

