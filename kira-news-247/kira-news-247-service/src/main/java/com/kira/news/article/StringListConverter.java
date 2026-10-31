package com.kira.news.article;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.List;

/** Small ordered lists (tags, source URLs) stored newline-separated in one VARCHAR2 column. */
@Converter
public class StringListConverter implements AttributeConverter<List<String>, String> {
    @Override
    public String convertToDatabaseColumn(List<String> values) {
        return values == null || values.isEmpty() ? null : String.join("\n", values);
    }

    @Override
    public List<String> convertToEntityAttribute(String column) {
        return column == null || column.isBlank() ? List.of() : List.of(column.split("\n"));
    }
}
