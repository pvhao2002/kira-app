package com.app.kira.tecum;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TecumDTO {
    private Long tecumAccountId;
    private String tecumName;
    private BigDecimal balance;
    private BigDecimal balanceHolding;
    private BigDecimal balanceLeftDividend;
    private BigDecimal bonus;
    private String updatedAt;
    private String note;
    @JsonIgnore
    private String tecumUsername;
    @JsonIgnore
    private String tecumPassword;
    @JsonIgnore
    private String tecumCookie;
    private List<Attendance> attendanceList;

    public TecumDTO(Map.Entry<Long, List<TecumDTO>> entry) {
        this.tecumAccountId = entry.getKey();
        this.tecumName = entry.getValue().getFirst().getTecumName();
        this.balance = entry.getValue().getFirst().getBalance();
        this.balanceHolding = entry.getValue().getFirst().getBalanceHolding();
        this.balanceLeftDividend = entry.getValue().getFirst().getBalanceLeftDividend();
        this.updatedAt = entry.getValue().getFirst().getUpdatedAt();
        this.note = entry.getValue().getFirst().getNote();
        this.bonus = entry.getValue().getFirst().getBonus();
        this.attendanceList = entry.getValue().stream()
                .filter(dto -> dto.getAttendanceDate() != null)
                .map(Attendance::new)
                .toList();
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Attendance {
        private String attendanceDate;
        private String status;
        private String createdAt;

        public Attendance(TecumDTO dto) {
            this.attendanceDate = dto.getAttendanceDate();
            this.status = dto.getStatus();
            this.createdAt = dto.getCreatedAt();
        }
    }

    @JsonIgnore
    private String attendanceDate;
    @JsonIgnore
    private String status;
    @JsonIgnore
    private String createdAt;
}
