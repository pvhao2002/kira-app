package kira.crawl.protobuf;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
class AiscoreProtobufServiceTest {

    @Autowired
    AiscoreProtobufService protobufService;

    @Test
    void loadsDescriptors() {
        assertNotNull(protobufService);
    }

    @Test
    void decodesEmptyMatchesPayload() {
        JsonNode decoded = protobufService.decodeMatches(new byte[0]);
        assertNotNull(decoded);
    }
}
