package com.kira.bank.lodging.application;

import com.kira.bank.attachment.R2StorageService;
import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.attachment.domain.AttachmentAiStatus;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import com.kira.bank.identity.domain.User;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.lodging.domain.*;
import com.kira.bank.lodging.infrastructure.*;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import static com.kira.bank.lodging.application.LodgingDtos.*;

@Service @RequiredArgsConstructor @Slf4j
public class LodgingService {
    private static final Set<String> ELECTRICITY_UNITS = Set.of("KWH", "MONTH");
    private static final Set<String> WATER_UNITS = Set.of("CUBIC_METER", "PERSON_MONTH", "MONTH");
    private static final Set<String> SERVICE_UNITS = Set.of("PERSON_MONTH", "MONTH");
    private static final Set<String> PARKING_UNITS = Set.of("VEHICLE_MONTH", "MONTH");
    private final LodgingListingRepository listings;
    private final LodgingReferenceLocationRepository locations;
    private final LodgingListingLocationRepository listingLocations;
    private final LodgingListingImageRepository images;
    private final LodgingReviewRepository reviews;
    private final AttachmentRepository attachments;
    private final UserRepository users;
    private final R2StorageService storage;
    private final MapboxClient mapbox;

    @Transactional public ListingResponse create(Long userId, ListingRequest request) {
        validateListing(request); LodgingListing listing = new LodgingListing(); listing.setOwnerId(userId); listing.setCreatedBy(userId); listing.setUpdatedBy(userId); apply(listing, request);
        listings.save(listing); replaceLocations(listing, request.referenceLocationIds(), userId); return response(userId, listing);
    }
    @Transactional public ListingResponse update(Long userId, Long id, ListingRequest request) {
        validateListing(request); LodgingListing listing = listing(id); requireEditor(userId, listing); requireVersion(listing.getVersion(), request.version());
        boolean recalculate = !Objects.equals(normalize(listing.getAddress()), normalize(request.address())) || !sameLocations(listing.getId(), request.referenceLocationIds());
        apply(listing, request); listing.setUpdatedBy(userId); if (recalculate) replaceLocations(listing, request.referenceLocationIds(), userId); return response(userId, listing);
    }
    @Transactional public void delete(Long userId, Long id) { LodgingListing listing = listing(id); requireEditor(userId, listing); listing.setDeletedAt(Instant.now()); listing.setUpdatedBy(userId); }
    @Transactional(readOnly = true) public Page<ListingResponse> page(Long userId, String search, Pageable pageable) {
        Page<LodgingListing> page = listings.search(normalize(search), PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(Sort.Direction.DESC, "updatedAt")));
        return page.map(listing -> response(userId, listing));
    }
    @Transactional(readOnly = true) public ListingResponse detail(Long userId, Long id) { return response(userId, listing(id)); }

    @Transactional public ReferenceLocationResponse createLocation(Long userId, ReferenceLocationRequest request) {
        LodgingReferenceLocation location = new LodgingReferenceLocation(); location.setName(request.name().trim()); location.setAddress(request.address().trim()); location.setCreatedBy(userId); location.setUpdatedBy(userId); locations.save(location); return locationResponse(userId, location);
    }
    @Transactional public ReferenceLocationResponse updateLocation(Long userId, Long id, ReferenceLocationRequest request) {
        LodgingReferenceLocation location = location(id); requireLocationEditor(userId, location); requireVersion(location.getVersion(), request.version());
        if (!Objects.equals(normalize(location.getAddress()), normalize(request.address())) && listingLocations.existsByReferenceLocationIdAndDeletedAtIsNull(id)) throw conflict("LOCATION_IN_USE", "Địa điểm đang được sử dụng");
        boolean addressChanged = !Objects.equals(normalize(location.getAddress()), normalize(request.address())); location.setName(request.name().trim()); location.setUpdatedBy(userId);
        if (addressChanged) { location.setAddress(request.address().trim()); clearLocationGeocode(location); } return locationResponse(userId, location);
    }
    @Transactional public void deleteLocation(Long userId, Long id) { LodgingReferenceLocation location = location(id); requireLocationEditor(userId, location); if (listingLocations.existsByReferenceLocationIdAndDeletedAtIsNull(id)) throw conflict("LOCATION_IN_USE", "Địa điểm đang được sử dụng"); location.setDeletedAt(Instant.now()); location.setUpdatedBy(userId); }
    @Transactional(readOnly = true) public List<ReferenceLocationResponse> locations(Long userId) { return locations.findByDeletedAtIsNull(Sort.by("name")).stream().map(location -> locationResponse(userId, location)).toList(); }
    public List<AddressSuggestionResponse> addressSuggestions(String query) { return mapbox.suggest(query).stream().map(value -> new AddressSuggestionResponse(value.mapboxId(), value.label())).toList(); }

    public void tryGeocodeLocation(Long userId, Long id) { LodgingReferenceLocation location = location(id); requireLocationEditor(userId, location); try { MapboxClient.Point point = mapbox.geocode(location.getAddress()); applyPoint(location, point); location.setGeocodeStatus(LodgingStatus.READY); location.setGeocodeError(null); } catch (ApiException ex) { log.warn("Lodging location geocode failed locationId={} actorId={} code={}", id, userId, ex.getCode()); location.setGeocodeStatus(LodgingStatus.FAILED); location.setGeocodeError(ex.getCode()); } location.setUpdatedBy(userId); locations.save(location); }
    public void tryRecalculate(Long userId, Long id) {
        LodgingListing listing = listing(id); requireEditor(userId, listing);
        try {
            MapboxClient.Point origin = mapbox.geocode(listing.getAddress()); applyPoint(listing, origin); listing.setGeocodeStatus(LodgingStatus.READY); listing.setGeocodeError(null); listings.save(listing);
            List<LodgingListingLocation> links = listingLocations.findByListingIdAndDeletedAtIsNull(id); List<LodgingReferenceLocation> selected = links.stream().map(link -> location(link.getReferenceLocationId())).toList();
            if (selected.stream().anyMatch(value -> value.getGeocodeStatus() != LodgingStatus.READY || value.getLongitude() == null || value.getLatitude() == null)) {
                log.warn("Lodging distance calculation deferred listingId={} actorId={} code=MAPBOX_LOCATION_NOT_READY", id, userId);
                links.forEach(link -> failed(link, "MAPBOX_LOCATION_NOT_READY")); listingLocations.saveAll(links); return;
            }
            List<MapboxClient.Point> destinations = selected.stream().map(this::point).toList(); List<Long> distances = mapbox.distances(origin, destinations);
            for (int i = 0; i < links.size(); i++) { LodgingListingLocation link = links.get(i); Long meters = distances.get(i); if (meters == null) failed(link, "MAPBOX_DISTANCE_UNAVAILABLE"); else { link.setDistanceMeters(meters); link.setDistanceStatus(LodgingStatus.READY); link.setDistanceError(null); link.setCalculatedAt(Instant.now()); } }
            listingLocations.saveAll(links);
        } catch (ApiException ex) { log.warn("Lodging distance calculation failed listingId={} actorId={} code={}", id, userId, ex.getCode()); listing.setGeocodeStatus(LodgingStatus.FAILED); listing.setGeocodeError(ex.getCode()); listings.save(listing); listingLocations.findByListingIdAndDeletedAtIsNull(id).forEach(link -> { failed(link, ex.getCode()); listingLocations.save(link); }); }
    }
    @Transactional public ImageResponse uploadImage(Long userId, Long id, MultipartFile file) throws IOException {
        LodgingListing listing = listing(id); requireEditor(userId, listing); if (images.countByListingIdAndDeletedAtIsNull(id) >= 10) throw bad("IMAGE_LIMIT_EXCEEDED", "Mỗi tin tối đa 10 ảnh");
        byte[] data = file.getBytes(); String mime = imageMime(data); if (file.isEmpty() || file.getSize() > 10L * 1024 * 1024 || mime == null || (file.getContentType() != null && !file.getContentType().equals(mime))) throw bad("INVALID_IMAGE", "Ảnh phải là JPEG, PNG hoặc WebP, tối đa 10 MB");
        String key = userId + "/lodging/" + UUID.randomUUID() + extension(mime); R2StorageService.StoredObject stored = storage.upload(key, data, mime); Attachment attachment = new Attachment(); attachment.setUserId(userId); attachment.setModule("lodging"); attachment.setDocumentType("PHOTO"); attachment.setStorageKey(key); attachment.setR2AccountId(stored.accountId()); attachment.setOriginalName(Optional.ofNullable(file.getOriginalFilename()).filter(value -> !value.isBlank()).orElse("photo")); attachment.setMimeType(mime); attachment.setSizeBytes(data.length); attachment.setSha256(hash(data)); attachment.setAiStatus(AttachmentAiStatus.NOT_REQUESTED); attachment.setCreatedBy(userId); attachment.setUpdatedBy(userId); attachments.save(attachment);
        LodgingListingImage image = new LodgingListingImage(); image.setListingId(id); image.setAttachmentId(attachment.getId()); image.setSortOrder(images.maxActiveSortOrder(id) + 1); image.setCreatedBy(userId); image.setUpdatedBy(userId); images.save(image); return imageResponse(image, attachment);
    }
    @Transactional public void deleteImage(Long userId, Long id, Long attachmentId) { LodgingListing listing = listing(id); requireEditor(userId, listing); LodgingListingImage image = images.findByListingIdAndAttachmentIdAndDeletedAtIsNull(id, attachmentId).orElseThrow(() -> notFound("IMAGE_NOT_FOUND", "Không tìm thấy ảnh")); images.delete(image); }
    @Transactional(readOnly = true) public Attachment content(Long userId, Long id, Long attachmentId) { listing(id); return attachments.findById(attachmentId).filter(value -> images.findByListingIdAndAttachmentIdAndDeletedAtIsNull(id, attachmentId).isPresent()).orElseThrow(() -> notFound("IMAGE_NOT_FOUND", "Không tìm thấy ảnh")); }
    @Transactional public ReviewResponse review(Long userId, Long id, ReviewRequest request) { listing(id); if (request.status() == LodgingReviewStatus.NOT_OK && (request.reason() == null || request.reason().isBlank())) throw bad("REVIEW_REASON_REQUIRED", "Review Không OK cần lý do"); LodgingReview review = reviews.findByListingIdAndUserIdAndDeletedAtIsNull(id, userId).orElseGet(() -> { LodgingReview value = new LodgingReview(); value.setListingId(id); value.setUserId(userId); value.setCreatedBy(userId); return value; }); review.setStatus(request.status()); review.setReason(blankToNull(request.reason())); review.setUpdatedBy(userId); reviews.save(review); return reviewResponse(review); }
    @Transactional(readOnly = true) public List<ReviewResponse> reviews(Long userId, Long id) { listing(id); return reviews.findByListingIdAndDeletedAtIsNullOrderByUpdatedAtDesc(id).stream().map(this::reviewResponse).toList(); }

    private ListingResponse response(Long userId, LodgingListing listing) {
        List<LodgingListingImage> links = images.findByListingIdAndDeletedAtIsNullOrderBySortOrder(listing.getId()); Map<Long, Attachment> files = new HashMap<>(); attachments.findAllById(links.stream().map(LodgingListingImage::getAttachmentId).toList()).forEach(file -> files.put(file.getId(), file));
        Map<Long, LodgingReferenceLocation> locationMap = new HashMap<>(); List<LodgingListingLocation> distanceLinks = listingLocations.findByListingIdAndDeletedAtIsNull(listing.getId()); distanceLinks.forEach(link -> locationMap.put(link.getReferenceLocationId(), location(link.getReferenceLocationId())));
        List<LodgingReview> allReviews = reviews.findByListingIdAndDeletedAtIsNullOrderByUpdatedAtDesc(listing.getId()); LodgingReview mine = allReviews.stream().filter(review -> review.getUserId().equals(userId)).findFirst().orElse(null); long ok = allReviews.stream().filter(review -> review.getStatus() == LodgingReviewStatus.OK).count();
        User owner = users.findById(listing.getOwnerId()).orElse(null); boolean edit = canEdit(userId, listing.getOwnerId());
        return new ListingResponse(listing.getId(), listing.getAddress(), listing.getFormattedAddress(), listing.getRentPrice(), fee(listing.getElectricityPrice(), listing.getElectricityUnit()), fee(listing.getWaterPrice(), listing.getWaterUnit()), fee(listing.getServicePrice(), listing.getServiceUnit()), fee(listing.getParkingPrice(), listing.getParkingUnit()), listing.getFacebookUrl(), listing.getPhone(), listing.getVideoUrl(), listing.getNote(), listing.getGeocodeStatus(), listing.getGeocodeError(), new OwnerResponse(listing.getOwnerId(), owner == null ? "" : owner.getFullName()), edit, edit, listing.getVersion(), links.stream().map(link -> imageResponse(link, files.get(link.getAttachmentId()))).toList(), distanceLinks.stream().map(link -> distanceResponse(link, locationMap.get(link.getReferenceLocationId()))).toList(), new ReviewSummary(ok, allReviews.size() - ok, mine == null ? null : mine.getStatus(), mine == null ? null : mine.getReason()), listing.getCreatedAt(), listing.getUpdatedAt());
    }
    private ReferenceLocationResponse locationResponse(Long userId, LodgingReferenceLocation location) { boolean edit = canLocationEdit(userId, location.getCreatedBy()); return new ReferenceLocationResponse(location.getId(), location.getName(), location.getAddress(), location.getFormattedAddress(), location.getGeocodeStatus(), location.getGeocodeError(), edit, edit && !listingLocations.existsByReferenceLocationIdAndDeletedAtIsNull(location.getId()), location.getVersion()); }
    private ReviewResponse reviewResponse(LodgingReview review) { User user = users.findById(review.getUserId()).orElse(null); return new ReviewResponse(review.getUserId(), user == null ? "" : user.getFullName(), review.getStatus(), review.getReason(), review.getUpdatedAt()); }
    private DistanceResponse distanceResponse(LodgingListingLocation link, LodgingReferenceLocation location) { return new DistanceResponse(link.getReferenceLocationId(), location.getName(), location.getAddress(), link.getDistanceMeters(), link.getDistanceStatus(), link.getDistanceError(), link.getCalculatedAt()); }
    private ImageResponse imageResponse(LodgingListingImage image, Attachment attachment) { return new ImageResponse(image.getAttachmentId(), attachment == null ? "" : attachment.getOriginalName(), "/api/v1/lodgings/" + image.getListingId() + "/images/" + image.getAttachmentId() + "/content", image.getSortOrder()); }
    private void replaceLocations(LodgingListing listing, List<Long> ids, Long userId) { List<LodgingListingLocation> old = listingLocations.findByListingIdAndDeletedAtIsNull(listing.getId()); listingLocations.deleteAllInBatch(old); List<Long> distinct = ids.stream().distinct().toList(); if (distinct.size() != ids.size()) throw bad("DUPLICATE_LOCATION", "Không được chọn trùng địa điểm"); distinct.forEach(locationId -> { location(locationId); LodgingListingLocation link = new LodgingListingLocation(); link.setListingId(listing.getId()); link.setReferenceLocationId(locationId); link.setCreatedBy(userId); link.setUpdatedBy(userId); listingLocations.save(link); }); }
    private void apply(LodgingListing listing, ListingRequest request) { listing.setAddress(request.address().trim()); listing.setRentPrice(request.rentPrice()); setFee(request.electricity(), ELECTRICITY_UNITS, listing::setElectricityPrice, listing::setElectricityUnit); setFee(request.water(), WATER_UNITS, listing::setWaterPrice, listing::setWaterUnit); setFee(request.service(), SERVICE_UNITS, listing::setServicePrice, listing::setServiceUnit); setFee(request.parking(), PARKING_UNITS, listing::setParkingPrice, listing::setParkingUnit); listing.setFacebookUrl(url(request.facebookUrl())); listing.setPhone(blankToNull(request.phone())); listing.setVideoUrl(url(request.videoUrl())); listing.setNote(blankToNull(request.note())); }
    private void setFee(FeeRequest fee, Set<String> allowed, java.util.function.Consumer<BigDecimal> amount, java.util.function.Consumer<String> unit) { if (fee == null || fee.amount() == null) { if (fee != null && fee.unit() != null && !fee.unit().isBlank()) throw bad("FEE_UNIT_WITHOUT_AMOUNT", "Đơn vị cần có số tiền"); amount.accept(null); unit.accept(null); return; } if (fee.amount().signum() < 0) throw bad("INVALID_FEE_AMOUNT", "Chi phí không được âm"); String value = fee.unit() == null ? "" : fee.unit().trim().toUpperCase(Locale.ROOT); if (!allowed.contains(value)) throw bad("INVALID_FEE_UNIT", "Đơn vị chi phí không hợp lệ"); amount.accept(fee.amount()); unit.accept(value); }
    private void validateListing(ListingRequest request) { if (request.referenceLocationIds().stream().distinct().count() != request.referenceLocationIds().size()) throw bad("DUPLICATE_LOCATION", "Không được chọn trùng địa điểm"); }
    private void clearLocationGeocode(LodgingReferenceLocation location) { location.setFormattedAddress(null); location.setMapboxId(null); location.setLongitude(null); location.setLatitude(null); location.setGeocodeStatus(LodgingStatus.PENDING); location.setGeocodeError(null); }
    private void applyPoint(LodgingReferenceLocation location, MapboxClient.Point point) { location.setMapboxId(point.mapboxId()); location.setFormattedAddress(point.formattedAddress()); location.setLongitude(point.longitude()); location.setLatitude(point.latitude()); }
    private void applyPoint(LodgingListing listing, MapboxClient.Point point) { listing.setMapboxId(point.mapboxId()); listing.setFormattedAddress(point.formattedAddress()); listing.setLongitude(point.longitude()); listing.setLatitude(point.latitude()); }
    private MapboxClient.Point point(LodgingReferenceLocation location) { return new MapboxClient.Point(location.getMapboxId(), location.getFormattedAddress(), location.getLongitude(), location.getLatitude()); }
    private void failed(LodgingListingLocation link, String code) { link.setDistanceStatus(LodgingStatus.FAILED); link.setDistanceError(code); link.setDistanceMeters(null); link.setCalculatedAt(Instant.now()); }
    private boolean sameLocations(Long id, List<Long> expected) { return listingLocations.findByListingIdAndDeletedAtIsNull(id).stream().map(LodgingListingLocation::getReferenceLocationId).collect(java.util.stream.Collectors.toSet()).equals(new HashSet<>(expected)); }
    private LodgingListing listing(Long id) { return listings.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> notFound("LODGING_NOT_FOUND", "Không tìm thấy tin trọ")); }
    private LodgingReferenceLocation location(Long id) { return locations.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> notFound("LOCATION_NOT_FOUND", "Không tìm thấy địa điểm")); }
    private void requireEditor(Long userId, LodgingListing listing) { if (!canEdit(userId, listing.getOwnerId())) throw new ApiException(HttpStatus.FORBIDDEN, "LODGING_FORBIDDEN", "Bạn không có quyền sửa tin này"); }
    private void requireLocationEditor(Long userId, LodgingReferenceLocation location) { if (!canLocationEdit(userId, location.getCreatedBy())) throw new ApiException(HttpStatus.FORBIDDEN, "LOCATION_FORBIDDEN", "Bạn không có quyền sửa địa điểm này"); }
    private boolean canEdit(Long userId, Long ownerId) { return Objects.equals(userId, ownerId) || admin(userId); }
    private boolean canLocationEdit(Long userId, Long ownerId) { return Objects.equals(userId, ownerId) || admin(userId); }
    private boolean admin(Long userId) { return users.findById(userId).map(user -> user.getRoles().stream().anyMatch(role -> "ROLE_ADMIN".equals(role.getName()))).orElse(false); }
    private void requireVersion(long actual, Long requested) { if (requested == null || requested != actual) throw conflict("LODGING_VERSION_CONFLICT", "Dữ liệu đã được thay đổi, hãy tải lại"); }
    private FeeRequest fee(BigDecimal amount, String unit) { return amount == null ? null : new FeeRequest(amount, unit); }
    private String url(String value) { String normalized = blankToNull(value); if (normalized != null && !(normalized.startsWith("https://") || normalized.startsWith("http://"))) throw bad("INVALID_URL", "Link phải bắt đầu bằng http:// hoặc https://"); return normalized; }
    private String normalize(String value) { return value == null ? "" : value.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
    private ApiException conflict(String code, String message) { return new ApiException(HttpStatus.CONFLICT, code, message); }
    private ApiException notFound(String code, String message) { return new ApiException(HttpStatus.NOT_FOUND, code, message); }
    private String imageMime(byte[] data) { if (data.length >= 3 && (data[0]&255)==255 && (data[1]&255)==216 && (data[2]&255)==255) return "image/jpeg"; byte[] png={(byte)137,80,78,71,13,10,26,10}; if(data.length>=png.length && Arrays.equals(Arrays.copyOf(data,png.length),png)) return "image/png"; if(data.length>=12 && new String(data,0,4,java.nio.charset.StandardCharsets.US_ASCII).equals("RIFF") && new String(data,8,4,java.nio.charset.StandardCharsets.US_ASCII).equals("WEBP")) return "image/webp"; return null; }
    private String extension(String mime) { return switch(mime) { case "image/jpeg" -> ".jpg"; case "image/png" -> ".png"; default -> ".webp"; }; }
    private String hash(byte[] data) { try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data)); } catch(Exception ex) { throw new IllegalStateException(ex); } }
}
