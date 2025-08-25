package com.app.kira.tecum;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TecumRespone {
    private Object json;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class TecumBalance {
        private BigDecimal balance;  // Số dư hiện tại
        private BigDecimal bonus;       // Số tiền thưởng đã nhận được từ lúc đăng ký
        private BigDecimal amount; // Đang đăng ký mua
        private BigDecimal leftDividend;  // Số tiền chờ chia cổ tức

        private List<Order> data;
        private Boolean hasNext;
        private CashFlowDTO.Cursor nextCursor;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Order {
        private BigDecimal totalDividend;

        private String amount;
        private String balance;
        private String createdAt;
        private String type;
        private Extra extra;

        public MapSqlParameterSource toParamTransaction(Long accountId) {
            return new MapSqlParameterSource()
                    .addValue("accountId", accountId)
                    .addValue("amount", amount)
                    .addValue("balance", balance)
                    .addValue("createdAt", createdAt)
                    .addValue("type", type)
                    .addValue("note", getNote());
        }

        public String getNote() {
            return "SHARE_REWARD".equalsIgnoreCase(type)
                    ? Optional.ofNullable(extra)
                    .map(e -> "%s - level promotion commission from %s".formatted(
                            Optional.ofNullable(e.getLevel()).map(String::valueOf).orElse(""),
                            Optional.ofNullable(e.getUser()).map(ExtraUser::getDisplayName).orElse("")
                    ))
                    .orElse(null)
                    : null;
        }
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Extra {
        private Integer level;
        private ExtraUser user;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class ExtraUser {
        private String displayName;
    }
}
