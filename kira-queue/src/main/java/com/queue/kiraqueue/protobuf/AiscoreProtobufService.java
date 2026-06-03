package com.queue.kiraqueue.protobuf;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queue.kiraqueue.config.AiscoreBadGatewayException;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.GZIPInputStream;

@Service
public class AiscoreProtobufService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;
    private static final String PACKAGE = "onescore.app.v1";

    private final Map<String, MessageSchema> messages = new HashMap<>();
    private final Map<String, EnumSchema> enums = new HashMap<>();
    private MessageSchema responseSchema;

    @PostConstruct
    void init() throws Exception {
        try (InputStream input = getClass().getResourceAsStream("/protobuf.json")) {
            if (input == null) {
                throw new IllegalStateException("Missing /protobuf.json on classpath");
            }
            var root = OBJECT_MAPPER.readTree(input);
            var packageNode = root.path("nested").path("onescore").path("nested").path("app").path("nested").path("v1");
            parseNested(packageNode.path("nested"), PACKAGE);
            responseSchema = requireMessage("Response");
        }
    }

    public JsonNode decodeMatches(byte[] body) {
        return decodeMessage("Matches", body);
    }

    public JsonNode decodeMatchOdds(byte[] body) {
        if (body == null || body.length == 0) {
            return JSON.nullNode();
        }
        return decodeMessage("MatchOdds", body);
    }

    public JsonNode decodeWebMatchOddsDetail(byte[] body) {
        return decodeMessage("WebMatchOddsDetail", body);
    }

    public JsonNode decodeMatchOddsDetail(byte[] body) {
        if (body == null || body.length == 0) {
            return JSON.nullNode();
        }
        return decodeMessage("MatchOddsDetail", body);
    }

    public JsonNode decodeMatchTeamStats(byte[] body) {
        if (body == null || body.length == 0) {
            return JSON.nullNode();
        }
        return decodeMessage("MatchTeamStats", body);
    }

    public JsonNode decodeWebMatchData(byte[] body) {
        return decodeMessage("WebMatchData", body);
    }

    private JsonNode decodeMessage(String messageName, byte[] body) {
        try {
            var payload = unwrapGzip(body);
            var innerPayload = unwrapResponseData(payload);
            return decodeObject(requireMessage(messageName), new Reader(innerPayload));
        } catch (AiscoreBadGatewayException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AiscoreBadGatewayException(
                    "Failed to decode AiScore protobuf message " + messageName,
                    Map.of("cause", ex.getMessage())
            );
        }
    }

    private byte[] unwrapGzip(byte[] body) throws Exception {
        if (body.length >= 2 && (body[0] & 0xFF) == 0x1F && (body[1] & 0xFF) == 0x8B) {
            try (var input = new GZIPInputStream(new java.io.ByteArrayInputStream(body))) {
                return input.readAllBytes();
            }
        }
        return body;
    }

    private byte[] unwrapResponseData(byte[] payload) {
        try {
            var wrapper = decodeObject(responseSchema, new Reader(payload));
            var data = wrapper.get("data");
            if (data != null && data.isTextual() && !data.asText().isBlank()) {
                return java.util.Base64.getDecoder().decode(data.asText());
            }
            return payload;
        } catch (Exception ex) {
            return payload;
        }
    }

    private ObjectNode decodeObject(MessageSchema schema, Reader reader) {
        var output = JSON.objectNode();
        while (!reader.exhausted()) {
            var tag = reader.readVarint();
            if (tag == 0) {
                break;
            }
            var fieldNumber = (int) (tag >>> 3);
            var wireType = (int) (tag & 0x07);
            var field = schema.fieldsById().get(fieldNumber);
            if (field == null) {
                reader.skip(wireType);
                continue;
            }

            if (field.map()) {
                putMapValue(output, field, reader.readLengthDelimited());
                continue;
            }

            if (field.repeated()) {
                var array = output.withArray(field.name());
                if (wireType == 2 && isPackable(field.type())) {
                    var packed = new Reader(reader.readLengthDelimited());
                    while (!packed.exhausted()) {
                        array.add(readScalar(field, packed, scalarWireType(field.type())));
                    }
                } else {
                    array.add(readValue(field, reader, wireType));
                }
                continue;
            }

            output.set(field.name(), readValue(field, reader, wireType));
        }
        return output;
    }

    private void putMapValue(ObjectNode output, FieldSchema field, byte[] entryBytes) {
        var mapNode = output.withObject(field.name());
        var entry = new Reader(entryBytes);
        String key = null;
        JsonNode value = null;
        while (!entry.exhausted()) {
            var tag = entry.readVarint();
            var fieldNumber = (int) (tag >>> 3);
            var wireType = (int) (tag & 0x07);
            if (fieldNumber == 1) {
                key = scalarToKey(field.keyType(), readScalarValue(field.keyType(), entry, wireType));
            } else if (fieldNumber == 2) {
                value = readValue(new FieldSchema("value", 2, field.type(), null, false, false), entry, wireType);
            } else {
                entry.skip(wireType);
            }
        }
        if (key != null && value != null) {
            mapNode.set(key, value);
        }
    }

    private JsonNode readValue(FieldSchema field, Reader reader, int wireType) {
        var message = resolveMessage(field.type(), field.owner());
        if (message != null) {
            return decodeObject(message, new Reader(reader.readLengthDelimited()));
        }
        return readScalar(field, reader, wireType);
    }

    private JsonNode readScalar(FieldSchema field, Reader reader, int wireType) {
        return scalarToJson(field.type(), readScalarValue(field.type(), reader, wireType));
    }

    private Object readScalarValue(String type, Reader reader, int wireType) {
        return switch (type) {
            case "double" -> Double.longBitsToDouble(reader.readFixed64());
            case "float" -> Float.intBitsToFloat(reader.readFixed32());
            case "int32", "uint32" -> (int) reader.readVarint();
            case "sint32" -> decodeZigZag32((int) reader.readVarint());
            case "int64", "uint64" -> reader.readVarint();
            case "sint64" -> decodeZigZag64(reader.readVarint());
            case "bool" -> reader.readVarint() != 0;
            case "string" -> new String(reader.readLengthDelimited(), StandardCharsets.UTF_8);
            case "bytes" -> java.util.Base64.getEncoder().encodeToString(reader.readLengthDelimited());
            case "fixed32", "sfixed32" -> reader.readFixed32();
            case "fixed64", "sfixed64" -> reader.readFixed64();
            default -> {
                var enumSchema = resolveEnum(type, null);
                if (enumSchema != null) {
                    yield enumSchema.nameFor((int) reader.readVarint());
                }
                reader.skip(wireType);
                yield null;
            }
        };
    }

    private JsonNode scalarToJson(String type, Object value) {
        if (value == null) {
            return JSON.nullNode();
        }
        return switch (type) {
            case "int64", "uint64", "sint64", "fixed64", "sfixed64" -> JSON.textNode(String.valueOf(value));
            case "int32", "uint32", "sint32", "fixed32", "sfixed32" -> JSON.numberNode(((Number) value).intValue());
            case "float", "double" -> JSON.numberNode(((Number) value).doubleValue());
            case "bool" -> JSON.booleanNode((Boolean) value);
            default -> JSON.textNode(String.valueOf(value));
        };
    }

    private String scalarToKey(String type, Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private int scalarWireType(String type) {
        return switch (type) {
            case "double", "fixed64", "sfixed64" -> 1;
            case "string", "bytes" -> 2;
            case "float", "fixed32", "sfixed32" -> 5;
            default -> 0;
        };
    }

    private boolean isPackable(String type) {
        return switch (type) {
            case "string", "bytes" -> false;
            default -> resolveMessage(type, null) == null;
        };
    }

    private void parseNested(JsonNode nested, String scope) {
        nested.fields().forEachRemaining(entry -> {
            var name = entry.getKey();
            var node = entry.getValue();
            var fullName = scope + "." + name;
            if (node.has("fields")) {
                parseMessage(name, fullName, node);
            } else if (node.has("values")) {
                parseEnum(name, fullName, node);
            }
        });
    }

    private void parseMessage(String name, String fullName, JsonNode node) {
        var fields = new LinkedHashMap<Integer, FieldSchema>();
        node.path("fields").fields().forEachRemaining(entry -> {
            var fieldName = entry.getKey();
            var fieldNode = entry.getValue();
            var id = fieldNode.path("id").asInt();
            var type = fieldNode.path("type").asText();
            var repeated = "repeated".equals(fieldNode.path("rule").asText());
            var map = fieldNode.has("keyType");
            var keyType = map ? fieldNode.path("keyType").asText() : null;
            fields.put(id, new FieldSchema(fieldName, id, type, keyType, repeated, map, fullName));
        });
        var schema = new MessageSchema(name, fullName, fields);
        messages.put(fullName, schema);
        messages.putIfAbsent(name, schema);
        if (node.has("nested")) {
            parseNested(node.path("nested"), fullName);
        }
    }

    private void parseEnum(String name, String fullName, JsonNode node) {
        var values = new HashMap<Integer, String>();
        node.path("values").fields().forEachRemaining(entry -> values.put(entry.getValue().asInt(), entry.getKey()));
        var schema = new EnumSchema(name, fullName, values);
        enums.put(fullName, schema);
        enums.putIfAbsent(name, schema);
    }

    private MessageSchema requireMessage(String name) {
        var schema = resolveMessage(name, PACKAGE);
        if (schema == null) {
            throw new IllegalStateException("Protobuf message not found: " + name);
        }
        return schema;
    }

    private MessageSchema resolveMessage(String type, String owner) {
        if (isScalar(type)) {
            return null;
        }
        var normalized = type.startsWith(".") ? type.substring(1) : type;
        if (messages.containsKey(normalized)) {
            return messages.get(normalized);
        }
        var scope = owner;
        while (scope != null && !scope.isBlank()) {
            var candidate = scope + "." + normalized;
            if (messages.containsKey(candidate)) {
                return messages.get(candidate);
            }
            var idx = scope.lastIndexOf('.');
            scope = idx < 0 ? null : scope.substring(0, idx);
        }
        return messages.get(PACKAGE + "." + normalized);
    }

    private EnumSchema resolveEnum(String type, String owner) {
        var normalized = type.startsWith(".") ? type.substring(1) : type;
        if (enums.containsKey(normalized)) {
            return enums.get(normalized);
        }
        return enums.get(PACKAGE + "." + normalized);
    }

    private boolean isScalar(String type) {
        return switch (type) {
            case "double", "float", "int32", "uint32", "sint32", "fixed32", "sfixed32",
                 "int64", "uint64", "sint64", "fixed64", "sfixed64", "bool", "string", "bytes" -> true;
            default -> false;
        };
    }

    private int decodeZigZag32(int value) {
        return (value >>> 1) ^ -(value & 1);
    }

    private long decodeZigZag64(long value) {
        return (value >>> 1) ^ -(value & 1);
    }

    private record MessageSchema(String name, String fullName, Map<Integer, FieldSchema> fieldsById) {
    }

    private record FieldSchema(
            String name,
            int id,
            String type,
            String keyType,
            boolean repeated,
            boolean map,
            String owner
    ) {
        FieldSchema(String name, int id, String type, String keyType, boolean repeated, boolean map) {
            this(name, id, type, keyType, repeated, map, null);
        }
    }

    private record EnumSchema(String name, String fullName, Map<Integer, String> valuesById) {
        String nameFor(int value) {
            return valuesById.getOrDefault(value, String.valueOf(value));
        }
    }

    private static final class Reader {
        private final byte[] data;
        private int position;

        Reader(byte[] data) {
            this.data = data;
        }

        boolean exhausted() {
            return position >= data.length;
        }

        long readVarint() {
            long value = 0;
            int shift = 0;
            while (shift < 64) {
                var b = data[position++] & 0xFF;
                value |= (long) (b & 0x7F) << shift;
                if ((b & 0x80) == 0) {
                    return value;
                }
                shift += 7;
            }
            throw new IllegalArgumentException("Invalid protobuf varint");
        }

        byte[] readLengthDelimited() {
            var length = (int) readVarint();
            var bytes = java.util.Arrays.copyOfRange(data, position, position + length);
            position += length;
            return bytes;
        }

        int readFixed32() {
            var value = ByteBuffer.wrap(data, position, 4).order(ByteOrder.LITTLE_ENDIAN).getInt();
            position += 4;
            return value;
        }

        long readFixed64() {
            var value = ByteBuffer.wrap(data, position, 8).order(ByteOrder.LITTLE_ENDIAN).getLong();
            position += 8;
            return value;
        }

        void skip(int wireType) {
            switch (wireType) {
                case 0 -> readVarint();
                case 1 -> position += 8;
                case 2 -> position += (int) readVarint();
                case 5 -> position += 4;
                default -> throw new IllegalArgumentException("Unsupported protobuf wire type: " + wireType);
            }
        }
    }
}
