package com.matchmind.security;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    @Query("select u from User u where lower(u.username) = lower(?1)")
    Optional<User> findByUsernameIgnoreCase(String username);

    List<User> findAllByOrderByUsernameAsc();

    long countByRoleAndStatus(String role, String status);
}
