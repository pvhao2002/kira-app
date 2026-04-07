package com.db.kiragateway.auth.service;

import com.db.kiragateway.auth.model.AuthenticatedUser;
import com.db.kiragateway.config.security.AppSecurityProperties;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class JwtTokenService {

    private final JwtEncoder jwtEncoder;
    private final AppSecurityProperties props;

    public JwtTokenService(JwtEncoder jwtEncoder, AppSecurityProperties props) {
        this.jwtEncoder = jwtEncoder;
        this.props = props;
    }

    public String generateAccessToken(AuthenticatedUser user) {
        var now = Instant.now();
        var expiresAt = now.plusSeconds(props.getJwt().getAccessTokenTtlSeconds());

        var claims = JwtClaimsSet.builder()
                .issuer(props.getJwt().getIssuer())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .subject(user.username())
                .claim("uid", user.userId())
                .claim("role", user.role())
                .build();

        var headers = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(headers, claims)).getTokenValue();
    }
}
