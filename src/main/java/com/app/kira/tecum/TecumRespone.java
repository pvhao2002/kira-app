package com.app.kira.tecum;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TecumRespone {
    private Object json;


    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class TecumBalance {
        private Double balance;  // Số dư hiện tại
        private Double bonus;       // Số tiền thưởng đã nhận được từ lúc đăng ký
        private Double amount; // Đang đăng ký mua
        private Double leftDividend;  // Số tiền chờ chia cổ tức
    }
}
