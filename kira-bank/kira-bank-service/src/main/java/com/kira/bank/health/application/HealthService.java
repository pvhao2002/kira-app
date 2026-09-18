package com.kira.bank.health.application;

import com.kira.bank.health.infrastructure.HealthRepository;
import com.kira.bank.shared.web.ApiException;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.*;
import java.util.*;

import static com.kira.bank.health.application.HealthDtos.*;

@Service
@RequiredArgsConstructor
public class HealthService {
    private final HealthRepository repo;
    private final Validator validator;

    public static ApiException invalid(String code) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, "Health request is invalid");
    }

    private static ApiException conflict() {
        return new ApiException(HttpStatus.CONFLICT, "HEALTH_VERSION_CONFLICT", "Reload before saving this health record");
    }

    private static void changed(int count) {
        if (count != 1) throw conflict();
    }

    public ProfileView profile(long user) {
        return repo.profile(user);
    }

    public ProfileView requireProfile(long user) {
        var p = profile(user);
        if (p == null) throw invalid("HEALTH_PROFILE_REQUIRED");
        return p;
    }

    public ZoneId zone(String name) {
        try {
            return ZoneId.of(name);
        } catch (DateTimeException e) {
            throw invalid("HEALTH_TIMEZONE_INVALID");
        }
    }

    public void validate(Object value) {
        if (!validator.validate(value).isEmpty()) throw invalid("HEALTH_VALIDATION_FAILED");
    }

    @Transactional
    public ProfileView saveProfile(long user, ProfileWrite p) {
        validate(p);
        var now = LocalDate.now(zone(p.data().timezone()));
        if (Period.between(p.data().birthDate(), now).getYears() < 20 || Period.between(p.data().birthDate(), now).getYears() > 120)
            throw invalid("HEALTH_ADULT_PROFILE_REQUIRED");
        int delta = p.data().calorieAdjustment();
        if ((p.data().goal().equals("LOSE") && delta > 0) || (p.data().goal().equals("GAIN") && delta < 0) || (p.data().goal().equals("MAINTAIN") && delta != 0))
            throw invalid("HEALTH_GOAL_ADJUSTMENT_MISMATCH");
        repo.lockUser(user);
        var device = repo.device(user);
        if (device != null && !device.timezone().equals(p.data().timezone()))
            throw invalid("HEALTH_DISCONNECT_BEFORE_TIMEZONE_CHANGE");
        var previous = repo.profile(user);
        if (previous == null) {
            if (p.version() != -1) throw conflict();
            repo.insertProfile(user, p.data());
        } else {
            changed(repo.updateProfile(user, p));
            if (!previous.data().timezone().equals(p.data().timezone())) repo.deleteDays(user);
        }
        return repo.profile(user);
    }

    public List<Weight> weights(long user) {
        return repo.weights(user);
    }

    @Transactional
    public void weight(long user, Weight w) {
        validate(w);
        var p = requireProfile(user).data();
        if (w.date().isAfter(LocalDate.now(zone(p.timezone())))) throw invalid("HEALTH_FUTURE_WEIGHT");
        if (w.date().isBefore(p.birthDate().plusYears(20))) throw invalid("HEALTH_ADULT_PROFILE_REQUIRED");
        repo.weight(user, w);
    }

    @Transactional
    public void deleteWeight(long user, LocalDate date) {
        repo.deleteWeight(user, date);
    }

    public List<PlanView> plans(long user, LocalDate week) {
        return repo.plans(user, week);
    }

    private PlanView requirePlan(long user, String id) {
        var p = repo.plan(user, id);
        if (p == null) throw new ApiException(HttpStatus.NOT_FOUND, "HEALTH_PLAN_NOT_FOUND", "Plan not found");
        return p;
    }

    public void validatePlan(Profile profile, LocalDate week, PlanData data) {
        validate(data);
        if (week.getDayOfWeek() != DayOfWeek.MONDAY) throw invalid("HEALTH_WEEK_MUST_START_MONDAY");
        for (var item : data.items()) {
            if (item.date().isBefore(week) || item.date().isAfter(week.plusDays(6)))
                throw invalid("HEALTH_PLAN_DATE_OUTSIDE_WEEK");
            if (item.kind().equals("REST") && (item.calories() != 0 || item.minutes() != 0))
                throw invalid("HEALTH_REST_INVALID");
            // Exact named exclusions are a deterministic gate; the user must also review semantic restrictions.
            String restrictions = item.kind().equals("MEAL") ? profile.allergies() + "," + profile.avoidedFoods() : profile.movementRestrictions();
            String text = normalize(item.title() + " " + item.portion() + " " + item.notes());
            for (String term : restrictions.split("[,;\\n]")) {
                String normalized = normalize(term.trim());
                if (!normalized.isBlank() && java.util.regex.Pattern.compile("(?<![\\p{L}\\p{N}])" + java.util.regex.Pattern.quote(normalized) + "(?![\\p{L}\\p{N}])").matcher(text).find())
                    throw invalid("HEALTH_PLAN_RESTRICTION_CONFLICT");
            }
        }
    }

    private String normalize(String value) {
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "").replace('đ', 'd');
    }

    @Transactional
    public PlanView savePlan(long user, String id, PlanWrite p) {
        validate(p);
        repo.lockUser(user);
        validatePlan(requireProfile(user).data(), p.weekStart(), p.data());
        if (id == null) {
            if (p.version() != -1) throw conflict();
            id = UUID.randomUUID().toString();
            repo.insertPlan(user, id, p);
        } else {
            var old = requirePlan(user, id);
            if (!old.weekStart().equals(p.weekStart())) throw invalid("HEALTH_PLAN_WEEK_IMMUTABLE");
            changed(repo.updatePlan(user, id, p));
        }
        return requirePlan(user, id);
    }

    @Transactional
    public PlanView approve(long user, String id, Approval request) {
        validate(request);
        repo.lockUser(user);
        var p = requirePlan(user, id);
        if (p.version() != request.version() || !p.status().equals("DRAFT")) throw conflict();
        validatePlan(requireProfile(user).data(), p.weekStart(), p.data());
        repo.approve(user, p);
        return requirePlan(user, id);
    }

    @Transactional
    public PlanView complete(long user, String id, int index, long version, boolean completed) {
        var p = requirePlan(user, id);
        if (index < 0 || index >= p.data().items().size()) throw invalid("HEALTH_PLAN_ITEM_INVALID");
        var items = new ArrayList<>(p.data().items());
        var old = items.get(index);
        items.set(index, new PlanItem(old.date(), old.kind(), old.title(), old.portion(), old.calories(), old.minutes(), old.notes(), completed));
        changed(repo.complete(user, id, new PlanData(p.data().title(), items, p.data().warnings()), version));
        return requirePlan(user, id);
    }

    public List<JournalView> journals(long user, LocalDate from, LocalDate to) {
        range(from, to);
        return repo.journals(user, from, to);
    }

    @Transactional
    public JournalView journal(long user, String id, JournalWrite p) {
        validate(p);
        if (p.date().isAfter(LocalDate.now(zone(requireProfile(user).data().timezone()))))
            throw invalid("HEALTH_FUTURE_JOURNAL");
        if (id == null) {
            if (p.version() != -1) throw conflict();
            id = UUID.randomUUID().toString();
            repo.insertJournal(user, id, p);
        } else changed(repo.updateJournal(user, id, p));
        String saved = id;
        return repo.journals(user, p.date(), p.date()).stream().filter(j -> j.id().equals(saved)).findFirst().orElseThrow();
    }

    @Transactional
    public void deleteJournal(long user, String id, long version) {
        changed(repo.deleteJournal(user, id, version));
    }

    public Device device(long user) {
        return repo.device(user);
    }

    @Transactional
    public Device connect(long user, Connect c) {
        validate(c);
        zone(c.timezone());
        repo.lockUser(user);
        if (!requireProfile(user).data().timezone().equals(c.timezone())) throw invalid("HEALTH_TIMEZONE_MISMATCH");
        var old = repo.device(user);
        if (old != null) {
            if (!old.deviceId().equals(c.deviceId().toString()) || !old.timezone().equals(c.timezone()))
                throw new ApiException(HttpStatus.CONFLICT, "HEALTH_DEVICE_ALREADY_CONNECTED", "Disconnect the current iPhone first");
            return old;
        }
        // Old daily snapshots cannot be mixed with a newly selected timezone or source phone.
        repo.deleteDays(user);
        repo.connect(user, c, UUID.randomUUID().toString());
        return repo.device(user);
    }

    @Transactional
    public void disconnect(long user, boolean deleteData) {
        repo.lockUser(user);
        repo.disconnect(user);
        if (deleteData) repo.deleteDays(user);
    }

    @Transactional
    public Device sync(long user, Sync s) {
        validate(s);
        repo.lockUser(user);
        var d = repo.device(user);
        if (d == null || !d.deviceId().equals(s.deviceId().toString()) || !d.generation().equals(s.generation().toString()))
            throw new ApiException(HttpStatus.CONFLICT, "HEALTH_DEVICE_DISCONNECTED", "Reconnect this iPhone");
        if (!d.timezone().equals(s.timezone())) throw invalid("HEALTH_TIMEZONE_MISMATCH");
        if (s.revision() <= d.lastRevision()) return d;
        if (s.revision() != d.lastRevision() + 1) throw conflict();
        Set<LocalDate> dates = new HashSet<>();
        Set<String> workoutIds = new HashSet<>();
        LocalDate today = LocalDate.now(zone(s.timezone()));
        for (Day day : s.days()) {
            if (!dates.add(day.date()) || day.date().isAfter(today)) throw invalid("HEALTH_SYNC_DATE_INVALID");
            for (Workout w : day.workouts()) {
                if (!workoutIds.add(w.id()) || !w.end().isAfter(w.start()) || !w.start().atZone(zone(s.timezone())).toLocalDate().equals(day.date()))
                    throw invalid("HEALTH_WORKOUT_INVALID");
            }
        }
        repo.sync(user, s);
        return repo.device(user);
    }

    public Summary summary(long user, LocalDate date) {
        var pv = profile(user);
        Profile p = pv == null ? null : pv.data();
        var weight = repo.weights(user).stream().filter(w -> !w.date().isAfter(date)).findFirst().orElse(null);
        Double bmi = null, rest = null, target = null;
        String source = "MISSING_PROFILE";
        Day day = repo.day(user, date);
        Double active = day == null ? null : day.activeCalories(), basal = day == null ? null : day.restingCalories();
        double eaten = repo.journals(user, date, date).stream().filter(j -> j.data().kind().equals("MEAL")).mapToDouble(j -> j.data().calories()).sum();
        if (p != null && weight != null && !date.isBefore(p.birthDate().plusYears(20))) {
            bmi = weight.kg() / Math.pow(p.heightCm() / 100, 2);
            rest = 10 * weight.kg() + 6.25 * p.heightCm() - 5 * Period.between(p.birthDate(), date).getYears() + (p.formulaSex().equals("MALE") ? 5 : -161);
            if (rest <= 0) rest = null;
            if (rest != null) {
                target = rest + (active == null ? rest * (p.activityFactor() - 1) : active) + p.calorieAdjustment();
                if (target <= 0) target = null;
                source = active == null ? "PROFILE_ESTIMATE" : "APPLE_HEALTH_PROVISIONAL";
            }
        }
        Double total = active == null || basal == null ? null : active + basal;
        return new Summary(date, round(bmi), round(rest), round(eaten), round(target), active, basal, round(total), total == null ? null : round(eaten - total), source, true, day == null ? null : day.steps(), day == null ? List.of() : day.workouts());
    }

    private Double round(Double n) {
        return n == null ? null : Math.round(n * 100d) / 100d;
    }

    private void range(LocalDate from, LocalDate to) {
        if (to.isBefore(from) || from.plusDays(90).isBefore(to)) throw invalid("HEALTH_RANGE_MAX_91_DAYS");
    }

    public List<Summary> statistics(long user, LocalDate from, LocalDate to) {
        range(from, to);
        return from.datesUntil(to.plusDays(1)).map(d -> summary(user, d)).toList();
    }
}
