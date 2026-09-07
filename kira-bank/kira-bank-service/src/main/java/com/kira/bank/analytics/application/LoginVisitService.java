package com.kira.bank.analytics.application;

import com.kira.bank.analytics.infrastructure.LoginVisitRepository;
import com.kira.bank.shared.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import java.time.*;
import java.util.*;
import static com.kira.bank.analytics.application.LoginVisitDtos.*;

@Service
@RequiredArgsConstructor
public class LoginVisitService {
    private final LoginVisitRepository repo;
    private final VisitIpResolver resolver;
    private final Map<String,Bucket> buckets=new HashMap<>();
    public static final int RETENTION_DAYS=90;
    private record Bucket(long minute,int count) {}
    // Bound the anonymous endpoint's write rate and in-memory bookkeeping.
    private synchronized boolean allow(String ip) {
        long minute=Instant.now().getEpochSecond()/60;
        var previous=buckets.get(ip);
        if(previous!=null && previous.minute()==minute) {
            if(previous.count()>=300) return false;
            buckets.put(ip,new Bucket(minute,previous.count()+1)); return true;
        }
        if(buckets.size()>=10000) buckets.entrySet().removeIf(e -> e.getValue().minute()!=minute);
        if(buckets.size()>=10000) return false;
        buckets.put(ip,new Bucket(minute,1)); return true;
    }
    public void record(VisitWrite visit,HttpServletRequest request) {
        var ip=resolver.resolve(request);
        if(!allow(ip.ip())) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"VISIT_RATE_LIMITED","Visit rate limit reached");
        String agent=Objects.toString(request.getHeader("User-Agent"),"");
        agent=agent.substring(0,Math.min(512,agent.length())).replaceAll("[\\p{Cntrl}]","");
        String referrer="";
        try {
            var uri=URI.create(visit.referrer());
            // Only keep the referring origin: paths, query strings and fragments may contain secrets.
            if(Set.of("http","https").contains(Objects.toString(uri.getScheme(),"")) && uri.getHost()!=null)
                referrer=new URI(uri.getScheme(),null,uri.getHost(),uri.getPort(),null,null,null).toString();
        } catch(Exception ignored) { }
        repo.insert(visit,ip,agent,referrer.substring(0,Math.min(500,referrer.length())));
    }
    public String validate(Instant from,Instant to,String ip,int page,int size) {
        if(!from.isBefore(to) || Duration.between(from,to).compareTo(Duration.ofDays(91))>0 || page<0 || page>100000 || size<1 || size>100)
            throw new ApiException(HttpStatus.BAD_REQUEST,"VISIT_FILTER_INVALID","Choose a range up to 91 days and a valid page");
        if(ip.isBlank()) return "";
        String normalized=VisitIpResolver.normalize(ip.trim());
        if(normalized==null) throw new ApiException(HttpStatus.BAD_REQUEST,"VISIT_IP_INVALID","Invalid IP address");
        return normalized;
    }
    @Transactional(readOnly=true)
    public Report report(Instant from,Instant to,String ip,int page,int size) {
        ip=validate(from,to,ip,page,size);
        var totals=repo.totals(from,to,ip);
        return new Report(totals,repo.ips(from,to,ip,page,size,totals.ips()),RETENTION_DAYS);
    }
    @Transactional(readOnly=true)
    public Page<Event> events(Instant from,Instant to,String ip,int page,int size) {
        return repo.events(from,to,validate(from,to,ip,page,size),page,size);
    }
    @Scheduled(cron="0 17 * * * *")
    public void purge() { repo.purge(Instant.now().minus(Duration.ofDays(RETENTION_DAYS))); }
}
