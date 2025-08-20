package com.app.kira.tecum;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TecumPayload {
    private String accountName;
    private String sdt;
    private String pass;

    public MapSqlParameterSource toMapSqlParameterSource() {
        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("tecum_name", accountName);
        params.addValue("tecum_username", sdt);
        params.addValue("tecum_password", pass);
        return params;
    }
}
