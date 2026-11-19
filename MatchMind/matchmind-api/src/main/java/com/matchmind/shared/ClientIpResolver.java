package com.matchmind.shared;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.util.Arrays;
import java.util.List;

/** Client IP that honours X-Forwarded-For only when the connection comes from a trusted proxy. */
@Component
public class ClientIpResolver {
    private final List<IpAddressMatcher> proxies;

    public ClientIpResolver(@Value("${app.trusted-proxies:127.0.0.1/32,::1/128}") String cidrs) {
        proxies = Arrays.stream(cidrs.split(",")).map(String::trim).filter(s -> !s.isEmpty())
            .map(IpAddressMatcher::new).toList();
    }

    static String normalize(String value) {
        if (value == null || value.length() > 45 || !value.matches("[0-9a-fA-F:.]+")) return null;
        if (!value.contains(":") && !value.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}")) return null;
        try {
            return InetAddress.getByName(value).getHostAddress();
        } catch (Exception ignored) {
            return null;
        }
    }

    public String resolve(HttpServletRequest request) {
        String peer = normalize(request.getRemoteAddr());
        if (peer == null) peer = "0.0.0.0";
        String header = request.getHeader("X-Forwarded-For");
        if (header == null || header.length() > 2048 || !trusted(peer)) return peer;
        String current = peer;
        String[] chain = header.split(",");
        for (int i = chain.length - 1; i >= 0 && trusted(current); i--) {
            String next = normalize(chain[i].trim());
            if (next == null) return peer;
            current = next;
        }
        return current;
    }

    private boolean trusted(String ip) {
        return proxies.stream().anyMatch(p -> p.matches(ip));
    }
}
