package com.app.kira.tecum;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TecumAccountDTO {
    private String tecumName;
    private String tecumUsername;
    private String tecumPassword;
}
