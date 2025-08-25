package com.app.kira.rest;

import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.InetAddress;
import java.net.UnknownHostException;

@Log
@RequestMapping("/analyst")
@RestController
@RequiredArgsConstructor
public class AnalystController {

    @GetMapping("os")
    public Object os() throws UnknownHostException {
        var address = InetAddress.getLocalHost();
        var hostName = address.getHostName();
        return System.getProperty("os.name") + " " + System.getProperty("os.version") + " " + hostName + " " + address.getHostAddress();
    }

}
