package com.kira.bank.lodging.infrastructure;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.kira.bank.lodging.config.MapboxProperties;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.List;

@Component @RequiredArgsConstructor @Slf4j
public class MapboxClient {
    private static final String HO_CHI_MINH_CITY_PROXIMITY = "106.7200,10.7550";
    private static final String HO_CHI_MINH_CITY_BBOX = "106.3550,10.3500,107.0300,11.1600";
    private final RestClient mapboxRestClient;
    private final MapboxProperties properties;

    public Point geocode(String address) {
        requireToken();
        try {
            String uri = "https://api.mapbox.com/search/geocode/v6/forward?q=" + URLEncoder.encode(address, StandardCharsets.UTF_8)
                + "&permanent=true&country=vn&language=vi&autocomplete=false&limit=5&proximity="
                + HO_CHI_MINH_CITY_PROXIMITY + "&bbox=" + HO_CHI_MINH_CITY_BBOX
                + "&access_token=" + properties.accessToken();
            GeocodeResponse response = mapboxRestClient.get().uri(uri).retrieve().body(GeocodeResponse.class);
            if (response == null || response.features == null || response.features.isEmpty()) throw unavailable("MAPBOX_ADDRESS_NOT_FOUND");
            Feature feature = response.features.stream().filter(this::isHoChiMinhCity).findFirst()
                .orElseThrow(() -> unavailable("MAPBOX_ADDRESS_OUTSIDE_HCM"));
            if (feature.geometry == null || feature.geometry.coordinates == null || feature.geometry.coordinates.size() < 2) throw unavailable("MAPBOX_ADDRESS_NOT_FOUND");
            return new Point(feature.id, feature.properties == null ? null : feature.properties.fullAddress,
                BigDecimal.valueOf(feature.geometry.coordinates.get(0)), BigDecimal.valueOf(feature.geometry.coordinates.get(1)));
        } catch (ApiException ex) { throw ex; }
        catch (RestClientException ex) { logProviderFailure("geocode", ex); throw unavailable("MAPBOX_UNAVAILABLE"); }
    }

    public List<AddressSuggestion> suggest(String query) {
        if (query == null || query.trim().length() < 3) return List.of();
        requireToken();
        try {
            String uri = "https://api.mapbox.com/search/geocode/v6/forward?q=" + URLEncoder.encode(query.trim(), StandardCharsets.UTF_8)
                + "&country=vn&language=vi&autocomplete=true&limit=5&proximity="
                + HO_CHI_MINH_CITY_PROXIMITY + "&bbox=" + HO_CHI_MINH_CITY_BBOX
                + "&access_token=" + properties.accessToken();
            GeocodeResponse response = mapboxRestClient.get().uri(uri).retrieve().body(GeocodeResponse.class);
            if (response == null || response.features == null) return List.of();
            return response.features.stream().filter(this::isHoChiMinhCity)
                .map(feature -> new AddressSuggestion(feature.id, label(feature))).filter(value -> !value.label().isBlank()).toList();
        } catch (RestClientException ex) { logProviderFailure("autocomplete", ex); throw unavailable("MAPBOX_UNAVAILABLE"); }
    }

    public List<Long> distances(Point origin, List<Point> destinations) {
        requireToken();
        try {
            String coordinates = join(origin, destinations);
            String uri = "https://api.mapbox.com/directions-matrix/v1/mapbox/driving/" + coordinates
                + "?sources=0&destinations=" + destinationIndexes(destinations.size()) + "&annotations=distance&access_token=" + properties.accessToken();
            MatrixResponse response = mapboxRestClient.get().uri(uri).retrieve().body(MatrixResponse.class);
            if (response == null || response.distances == null || response.distances.isEmpty()) throw unavailable("MAPBOX_DISTANCE_UNAVAILABLE");
            return response.distances.getFirst().stream().map(value -> value == null ? null : Math.round(value)).toList();
        } catch (ApiException ex) { throw ex; }
        catch (RestClientException ex) { logProviderFailure("distance-matrix", ex); throw unavailable("MAPBOX_UNAVAILABLE"); }
    }

    private void requireToken() { if (properties.accessToken() == null || properties.accessToken().isBlank()) { log.warn("Mapbox request skipped code=MAPBOX_NOT_CONFIGURED"); throw unavailable("MAPBOX_NOT_CONFIGURED"); } }
    private void logProviderFailure(String operation, RestClientException exception) {
        if (exception instanceof RestClientResponseException response) {
            log.warn("Mapbox request failed operation={} status={} exception={}", operation,
                response.getStatusCode().value(), exception.getClass().getSimpleName());
            return;
        }
        log.warn("Mapbox request failed operation={} exception={}", operation, exception.getClass().getSimpleName());
    }
    private ApiException unavailable(String code) { return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, code, "Không thể tính khoảng cách lúc này"); }
    private String join(Point origin, List<Point> destinations) {
        return format(origin) + ";" + destinations.stream().map(this::format).collect(java.util.stream.Collectors.joining(";"));
    }
    private String format(Point point) { return point.longitude.toPlainString() + "," + point.latitude.toPlainString(); }
    private String destinationIndexes(int count) { return java.util.stream.IntStream.rangeClosed(1, count).mapToObj(String::valueOf).collect(java.util.stream.Collectors.joining(";")); }
    private String label(Feature feature) {
        if (feature.properties != null && feature.properties.fullAddress != null && !feature.properties.fullAddress.isBlank()) return feature.properties.fullAddress;
        if (feature.fullAddress != null && !feature.fullAddress.isBlank()) return feature.fullAddress;
        if (feature.name != null && feature.placeFormatted != null) return feature.name + ", " + feature.placeFormatted;
        return feature.name == null ? "" : feature.name;
    }
    private boolean isHoChiMinhCity(Feature feature) {
        String region = feature.properties == null || feature.properties.context == null || feature.properties.context.region == null
            ? "" : feature.properties.context.region.name;
        return normalized(region).contains("ho chi minh") || normalized(label(feature)).contains("ho chi minh");
    }
    private String normalized(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "").toLowerCase(java.util.Locale.ROOT);
    }
    public record Point(String mapboxId, String formattedAddress, BigDecimal longitude, BigDecimal latitude) {}
    public record AddressSuggestion(String mapboxId, String label) {}
    @JsonIgnoreProperties(ignoreUnknown = true) record GeocodeResponse(List<Feature> features) {}
    @JsonIgnoreProperties(ignoreUnknown = true) record Feature(String id, String name, @JsonProperty("place_formatted") String placeFormatted,
                                                                @JsonProperty("full_address") String fullAddress, Geometry geometry, Properties properties) {}
    @JsonIgnoreProperties(ignoreUnknown = true) record Geometry(List<Double> coordinates) {}
    @JsonIgnoreProperties(ignoreUnknown = true) record Properties(@JsonProperty("full_address") String fullAddress, Context context) {}
    @JsonIgnoreProperties(ignoreUnknown = true) record Context(Region region) {}
    @JsonIgnoreProperties(ignoreUnknown = true) record Region(String name) {}
    @JsonIgnoreProperties(ignoreUnknown = true) record MatrixResponse(List<List<Double>> distances) {}
}
