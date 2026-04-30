package kira.schema.service;

public record SchemaSyncResult(int exitCode, boolean hadOrphanColumns) {}
