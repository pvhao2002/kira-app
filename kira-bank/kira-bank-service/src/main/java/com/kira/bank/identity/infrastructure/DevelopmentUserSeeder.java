package com.kira.bank.identity.infrastructure;

import com.kira.bank.identity.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component @RequiredArgsConstructor
public class DevelopmentUserSeeder implements ApplicationRunner {
    private final UserRepository users; private final RoleRepository roles; private final PasswordEncoder encoder;
    @Value("${app.seed-development-users:false}") boolean enabled;
    @Override @Transactional public void run(ApplicationArguments args){
        if(!enabled)return; create("admin@kira.local","KiraAdmin123!","Quản trị Kira",true); create("user@kira.local","KiraUser123!","Người dùng Kira",false);
    }
    private void create(String email,String password,String name,boolean admin){
        if(users.existsByEmailIgnoreCase(email))return; User u=new User();u.setEmail(email);u.setPasswordHash(encoder.encode(password));u.setFullName(name);
        u.getRoles().add(roles.findByName("ROLE_USER").orElseThrow()); if(admin)u.getRoles().add(roles.findByName("ROLE_ADMIN").orElseThrow());users.save(u);
    }
}
