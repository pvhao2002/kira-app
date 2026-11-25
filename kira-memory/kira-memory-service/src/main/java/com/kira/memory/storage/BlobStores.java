package com.kira.memory.storage;

import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class BlobStores {
    private final Map<StorageProvider, BlobStore> stores = new EnumMap<>(StorageProvider.class);

    public BlobStores(List<BlobStore> all) {
        all.forEach(s -> stores.put(s.provider(), s));
    }

    public BlobStore get(StorageProvider provider) {
        return stores.get(provider);
    }
}
