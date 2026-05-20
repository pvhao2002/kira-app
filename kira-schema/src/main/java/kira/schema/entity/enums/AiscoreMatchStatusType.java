package kira.schema.entity.enums;

/**
 * Loai ma tra cuu trong {@code aiscore_match_status_ref}.
 * <ul>
 *   <li>{@link #status_id} — map {@code events.status_id} (chi tiet: HT, FT, ET, ...)</li>
 *   <li>{@link #match_status} — map {@code matchStatus} gop tu AiScore API</li>
 * </ul>
 */
public enum AiscoreMatchStatusType {
    status_id,
    match_status
}
