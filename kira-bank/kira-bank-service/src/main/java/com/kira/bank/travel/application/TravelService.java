package com.kira.bank.travel.application;

import com.kira.bank.shared.web.ApiException;
import com.kira.bank.travel.infrastructure.TravelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.net.URI;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static com.kira.bank.travel.application.TravelDtos.*;

@Service
@RequiredArgsConstructor
public class TravelService {
    private final TravelRepository repo;

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "TRAVEL_INVALID", message);
    }

    private static ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "TRAVEL_NOT_FOUND", "Travel record not found");
    }

    private static void changed(int count) {
        if (count != 1)
            throw new ApiException(HttpStatus.CONFLICT, "TRAVEL_VERSION_CONFLICT", "Reload this trip before saving again");
    }

    private Trip require(long user, String id, boolean lock) {
        var trip = repo.find(user, id, lock);
        if (trip == null) throw missing();
        return trip;
    }

    public List<TripView> list(long user) {
        return repo.list(user).stream().map(this::view).toList();
    }

    public TripView get(long user, String id) {
        return view(require(user, id, false));
    }

    private TripView view(Trip trip) {
        return new TripView(trip.id(), trip.data(), trip.version(), summary(trip.data()));
    }

    @Transactional
    public TripView save(long user, String id, TripWrite write) {
        validate(write.data());
        if (id == null) {
            if (write.version() != -1) changed(0);
            id = UUID.randomUUID().toString();
            repo.insert(user, id, write.data());
        } else {
            var previous = require(user, id, true);
            if (!previous.data().expenses().isEmpty() && !previous.data().currency().equals(write.data().currency()))
                throw invalid("Remove expenses before changing the trip currency");
            changed(repo.update(user, id, write));
        }
        return get(user, id);
    }

    @Transactional
    public void delete(long user, String id, long version) {
        require(user, id, true);
        changed(repo.delete(user, id, version));
    }

    private void unique(List<String> ids) {
        if (new HashSet<>(ids).size() != ids.size()) throw invalid("Duplicate item identifiers");
    }

    private long minor(BigDecimal value, int scale) {
        try {
            return value.movePointRight(scale).longValueExact();
        } catch (ArithmeticException e) {
            throw invalid("Amount has invalid currency precision");
        }
    }

    private void validate(TripData data) {
        if (data.endDate().isBefore(data.startDate()) || ChronoUnit.DAYS.between(data.startDate(), data.endDate()) > 730)
            throw invalid("Trip dates must be ordered and within two years");
        try {
            ZoneId.of(data.timezone());
        } catch (DateTimeException e) {
            throw invalid("Invalid timezone");
        }
        int scale = Currency.getInstance(data.currency()).getDefaultFractionDigits();
        minor(data.budget(), scale);
        unique(data.members().stream().map(Member::id).toList());
        unique(data.activities().stream().map(Activity::id).toList());
        unique(data.packing().stream().map(Packing::id).toList());
        unique(data.shopping().stream().map(ShoppingItem::id).toList());
        unique(data.preparations().stream().map(PreparationItem::id).toList());
        unique(data.checklist().stream().map(ChecklistItem::id).toList());
        unique(data.expenses().stream().map(Expense::id).toList());
        unique(data.bookings().stream().map(Booking::id).toList());
        unique(data.places().stream().map(Place::id).toList());
        Set<String> members = new HashSet<>(data.members().stream().map(Member::id).toList());
        for (var activity : data.activities()) {
            if (activity.date().isBefore(data.startDate()) || activity.date().isAfter(data.endDate()))
                throw invalid("Itinerary dates must be within the trip");
        }
        for (var preparation : data.preparations()) {
            if (preparation.dueDate() != null && preparation.dueDate().isAfter(data.startDate()))
                throw invalid("Preparation due dates must be on or before the trip starts");
        }
        for (var expense : data.expenses()) {
            unique(expense.participants());
            if (!members.contains(expense.paidBy()) || !members.containsAll(expense.participants()))
                throw invalid("Expense members must belong to the trip");
            minor(expense.amount(), scale);
        }
        if (data.expenses().stream().map(Expense::amount).reduce(BigDecimal.ZERO, BigDecimal::add)
            .compareTo(new BigDecimal("1000000000000")) > 0)
            throw invalid("Total trip expenses exceed the supported limit");
        for (var booking : data.bookings()) {
            if (!booking.url().isBlank()) {
                try {
                    var uri = URI.create(booking.url());
                    if (!Set.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
                        throw invalid("Booking links must use HTTP or HTTPS");
                } catch (IllegalArgumentException e) {
                    throw invalid("Invalid booking link");
                }
            }
        }
    }

    // Integer minor units preserve the total, including an indivisible remainder.
    public Summary summary(TripData data) {
        int scale = Currency.getInstance(data.currency()).getDefaultFractionDigits();
        Map<String, Long> paid = new LinkedHashMap<>(), owed = new LinkedHashMap<>();
        data.members().forEach(m -> {
            paid.put(m.id(), 0L);
            owed.put(m.id(), 0L);
        });
        long total = 0;
        for (var expense : data.expenses()) {
            long amount = minor(expense.amount(), scale);
            total += amount;
            paid.merge(expense.paidBy(), amount, Long::sum);
            var participants = expense.participants().stream().sorted().toList();
            for (int i = 0; i < participants.size(); i++)
                owed.merge(participants.get(i), amount / participants.size() + (i < amount % participants.size() ? 1L : 0L), Long::sum);
        }
        List<Balance> balances = new ArrayList<>();
        Map<String, Long> net = new LinkedHashMap<>();
        for (var member : data.members()) {
            long p = paid.get(member.id()), o = owed.get(member.id());
            net.put(member.id(), p - o);
            balances.add(new Balance(member.id(), BigDecimal.valueOf(p, scale), BigDecimal.valueOf(o, scale), BigDecimal.valueOf(p - o, scale)));
        }
        List<Transfer> transfers = new ArrayList<>();
        for (String debtor : net.keySet()) {
            if (net.get(debtor) >= 0) continue;
            for (String creditor : net.keySet()) {
                if (net.get(creditor) <= 0) continue;
                long amount = Math.min(-net.get(debtor), net.get(creditor));
                if (amount == 0) break;
                transfers.add(new Transfer(debtor, creditor, BigDecimal.valueOf(amount, scale)));
                net.put(debtor, net.get(debtor) + amount);
                net.put(creditor, net.get(creditor) - amount);
            }
        }
        return new Summary(BigDecimal.valueOf(total, scale), balances, transfers);
    }

    public List<FileView> files(long user, String trip) {
        require(user, trip, false);
        return repo.files(user, trip);
    }

    @Transactional
    public FileView upload(long user, String trip, MultipartFile file) {
        require(user, trip, true);
        if (file.isEmpty() || file.getSize() > 5 * 1024 * 1024) throw invalid("File must be between 1 byte and 5 MB");
        if (repo.files(user, trip).size() >= 20) throw invalid("Maximum 20 files per trip");
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (java.io.IOException e) {
            throw invalid("Could not read file");
        }
        String type;
        if (bytes.length >= 5 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F' && bytes[4] == '-')
            type = "application/pdf";
        else if (bytes.length >= 8 && (bytes[0] & 255) == 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71 && bytes[4] == 13 && bytes[5] == 10 && bytes[6] == 26 && bytes[7] == 10)
            type = "image/png";
        else if (bytes.length >= 3 && (bytes[0] & 255) == 255 && (bytes[1] & 255) == 216 && (bytes[2] & 255) == 255)
            type = "image/jpeg";
        else throw invalid("Only PDF, PNG and JPEG files are supported");
        String name = Objects.toString(file.getOriginalFilename(), "booking").replaceAll("[\\p{Cntrl}\\\\/:*?\"<>|]", "_");
        name = name.substring(0, Math.min(160, name.length()));
        // Use the detected type's extension, never an executable extension supplied by the client.
        name = name.replaceFirst("\\.[^.]*$", "") + (type.equals("application/pdf") ? ".pdf" : type.equals("image/png") ? ".png" : ".jpg");
        var metadata = new FileView(UUID.randomUUID().toString(), name, type, bytes.length);
        repo.insertFile(trip, metadata, bytes);
        return metadata;
    }

    public FileContent download(long user, String trip, String id) {
        var file = repo.file(user, trip, id);
        if (file == null) throw missing();
        return file;
    }

    @Transactional
    public void deleteFile(long user, String trip, String id) {
        require(user, trip, true);
        if (repo.deleteFile(user, trip, id) != 1) throw missing();
    }
}
