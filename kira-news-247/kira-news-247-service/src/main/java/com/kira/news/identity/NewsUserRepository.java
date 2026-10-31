package com.kira.news.identity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NewsUserRepository extends JpaRepository<NewsUser, Long> {
    Optional<NewsUser> findByUsername(String username);

    boolean existsByUsername(String username);
}
