package com.kira.bank.identity.infrastructure;

import com.kira.bank.identity.application.JwtService;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component @RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwt; private final UserRepository users;
    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
        String header=req.getHeader("Authorization");
        if(header!=null&&header.startsWith("Bearer ")&&SecurityContextHolder.getContext().getAuthentication()==null){
            try { Long id=jwt.subject(header.substring(7)); users.findById(id).filter(u->"ACTIVE".equals(u.getStatus())&&u.getDeletedAt()==null).ifPresent(u->{
                var authorities=u.getRoles().stream().map(r->new SimpleGrantedAuthority(r.getName())).toList();
                SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(id,null,authorities));
            }); } catch(RuntimeException ignored) { /* invalid tokens are handled as unauthenticated; token value is never logged */ }
        }
        chain.doFilter(req,res);
    }
}

