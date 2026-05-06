package com.db.kiragateway.dto;

import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

@Getter
@Setter
public class DescribeInstrumentRequest {
    private MultipartFile image;
    private String prompt;
}
