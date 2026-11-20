package com.matchmind.shared;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdScalarDeserializer;
import com.fasterxml.jackson.datatype.jsr310.deser.InstantDeserializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.time.Instant;

/**
 * An {@link Instant} is only read from an ISO-8601 string with an offset. Jackson's default also reads numbers as epoch
 * seconds, so an agent sending JavaScript epoch milliseconds stored the year 58882 and broke every list page (UX-084).
 */
@Configuration
public class JacksonConfig {
    @Bean
    Jackson2ObjectMapperBuilderCustomizer isoOnlyInstants() {
        return builder -> builder.deserializerByType(Instant.class, new IsoInstantDeserializer());
    }

    static final class IsoInstantDeserializer extends StdScalarDeserializer<Instant> {
        IsoInstantDeserializer() {
            super(Instant.class);
        }

        @Override
        public Instant deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
            if (!p.hasToken(JsonToken.VALUE_STRING)) return (Instant) ctxt.handleUnexpectedToken(Instant.class, p);
            return InstantDeserializer.INSTANT.deserialize(p, ctxt);
        }
    }
}
