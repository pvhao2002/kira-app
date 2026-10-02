package com.kira.farm.inventory;

import com.kira.farm.inventory.application.InventoryRow;
import com.kira.farm.inventory.application.StockLevel;
import com.kira.farm.shared.web.ApiException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class StockLevelTest {
    @Test
    void levelsByAvailableUnits() {
        assertEquals(StockLevel.OUT, StockLevel.of(0));
        assertEquals(StockLevel.OUT, StockLevel.of(-3));
        assertEquals(StockLevel.LOW, StockLevel.of(1));
        assertEquals(StockLevel.LOW, StockLevel.of(9));
        assertEquals(StockLevel.OK, StockLevel.of(10));
        assertEquals("LOW", new InventoryRow(1L, "S", "n", "kg", 1L, 12, 5).level());
    }

    @Test
    void rangesAreContiguousAndParsingIsCaseInsensitive() {
        assertEquals(0, StockLevel.OUT.maxAvailable());
        assertEquals(1, StockLevel.LOW.minAvailable());
        assertEquals(9, StockLevel.LOW.maxAvailable());
        assertEquals(10, StockLevel.OK.minAvailable());
        assertEquals(StockLevel.LOW, StockLevel.parse("low"));
        assertEquals("INVALID_PARAMETER", assertThrows(ApiException.class, () -> StockLevel.parse("full")).getCode());
    }
}
