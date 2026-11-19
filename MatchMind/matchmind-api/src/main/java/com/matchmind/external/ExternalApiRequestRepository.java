package com.matchmind.external;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ExternalApiRequestRepository extends JpaRepository<ExternalApiRequest, UUID> {
}
