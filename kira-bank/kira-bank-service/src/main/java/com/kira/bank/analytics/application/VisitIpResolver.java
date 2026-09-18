package com.kira.bank.analytics.application;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.util.Arrays;
import java.util.List;

@Component
public class VisitIpResolver {
    private final List<IpAddressMatcher> proxies;

    public VisitIpResolver(@Value("${analytics.trusted-proxies:127.0.0.1/32,::1/128}") String cidrs) {
        proxies = Arrays.stream(cidrs.split(",")).map(String::trim).filter(s -> !s.isEmpty()).map(IpAddressMatcher::new).toList();
    }

    public static String normalize(String value) {
        if (value == null || value.length() > 45 || !value.matches("[0-9a-fA-F:.]+")) return null;
        if (!value.contains(":") && !value.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}")) return null;
        try {
            return InetAddress.getByName(value).getHostAddress();
        } catch (Exception e) {
            return null;
        }
    }

    private boolean trusted(String ip) {
        return proxies.stream().anyMatch(p -> p.matches(ip));
    }

    public Resolved resolve(HttpServletRequest request) {
        String peer = normalize(request.getRemoteAddr());
        if (peer == null) peer = "0.0.0.0";
        String header = request.getHeader("X-Forwarded-For");
        if (!trusted(peer) || header == null || header.length() > 2048) return new Resolved(peer, peer, "CONNECTION");
        String current = peer;
        String[] chain = header.split(",");
        for (int i = chain.length - 1; i >= 0 && trusted(current); i--) {
            String next = normalize(chain[i].trim());
            if (next == null) return new Resolved(peer, peer, "CONNECTION");
            current = next;
        }
        return new Resolved(current, peer, "TRUSTED_PROXY");
    }

    public record Resolved(String ip, String peer, String source) {
    }
}
