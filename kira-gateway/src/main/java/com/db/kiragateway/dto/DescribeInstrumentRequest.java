package com.db.kiragateway.dto;

import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

@Setter
@Getter
public class DescribeInstrumentRequest {
    private MultipartFile image;
    private String prompt;
}
