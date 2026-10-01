package com.kira.farm.catalog.infrastructure;

import com.kira.farm.branch.domain.Branch;
import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.catalog.application.Slugs;
import com.kira.farm.catalog.domain.Product;
import com.kira.farm.catalog.domain.ProductGroup;
import com.kira.farm.inventory.application.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Locale;

/** Dev-only demo catalogue (UI mock CATALOG): 7 similar groups x 5 branches. Skipped if products already exist. */
@Component
@Order(2)
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app", name = "seed-development-users", havingValue = "true")
public class CatalogSeeder implements ApplicationRunner {
    private static final String[] BRANCH_CODES = {"Q7", "Q3", "TD", "BT", "DL"};

    private record Group(String name, String sku, String unit, String category, String[] names, long[] price,
                         int[] stock, Long q7OldPrice, String q7Badge) {
    }

    private static final Group[] GROUPS = {
        new Group("Trứng gà ta · hộp 10", "TGT10", "hộp", "trung",
            new String[]{"Trứng gà ta – 10 quả", "Trứng gà ta Ba Vì – 10 quả", "Trứng gà ta thả vườn – 10 quả", "Trứng gà ta – 10 quả", "Trứng gà ta Đà Lạt – 10 quả"},
            new long[]{45000, 48000, 46000, 47000, 42000}, new int[]{86, 42, 5, 0, 120}, 52000L, "Bán chạy"),
        new Group("Gà ta làm sạch", "GTLS", "kg", "ga",
            new String[]{"Gà ta thả vườn làm sạch", "Gà ta Tiên Yên làm sạch", "Gà ta làm sạch", "Gà ri làm sạch", "Gà ta đồi làm sạch"},
            new long[]{189000, 205000, 195000, 179000, 175000}, new int[]{14, 9, 22, 0, 30}, 215000L, "-12%"),
        new Group("Trứng hữu cơ", "THC06", "hộp", "trung",
            new String[]{"Trứng gà hữu cơ – 6 quả", "Trứng hữu cơ – 6 quả", "Trứng gà hữu cơ – 10 quả", "Trứng hữu cơ – 6 quả", "Trứng hữu cơ – 6 quả"},
            new long[]{52000, 55000, 82000, 54000, 49000}, new int[]{40, 0, 18, 12, 60}, null, "Hữu cơ"),
        new Group("Vịt làm sạch", "VXLS", "kg", "giacam",
            new String[]{"Vịt xiêm làm sạch", "Vịt cỏ làm sạch", "Vịt xiêm làm sạch", "Vịt bầu làm sạch", "Vịt xiêm làm sạch"},
            new long[]{165000, 149000, 160000, 155000, 150000}, new int[]{11, 8, 0, 6, 15}, null, null),
        new Group("Trứng omega · khay 30", "TOM30", "khay", "trung",
            new String[]{"Trứng gà omega – khay 30", "Trứng omega – khay 30", "Trứng omega – khay 30", "Trứng omega – khay 30", "Trứng omega – khay 30"},
            new long[]{135000, 139000, 135000, 142000, 128000}, new int[]{24, 31, 12, 4, 50}, null, null),
        new Group("Gà giống", "GGDT", "con", "giong",
            new String[]{"Gà giống Đông Tảo", "Gà giống Đông Tảo", "Gà giống Mía", "Gà giống ta", "Gà giống Đông Tảo"},
            new long[]{45000, 48000, 38000, 30000, 42000}, new int[]{0, 0, 40, 25, 80}, null, null),
        new Group("Cám gà 25kg", "CAM25", "bao", "thucan",
            new String[]{"Cám hỗn hợp gà thả vườn 25kg", "Cám gà 25kg", "Cám gà thả vườn 25kg", "Cám gà 25kg", "Cám hỗn hợp 25kg"},
            new long[]{385000, 395000, 380000, 390000, 370000}, new int[]{16, 7, 20, 0, 44}, null, null)
    };

    private final ProductRepository products;
    private final ProductGroupRepository groups;
    private final CategoryRepository categories;
    private final BranchRepository branches;
    private final InventoryService inventory;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (products.count() > 0) return;
        for (Group g : GROUPS) {
            ProductGroup group = new ProductGroup();
            group.setCode(Slugs.slugify(g.name()));
            group.setName(g.name());
            group = groups.save(group);
            for (int i = 0; i < BRANCH_CODES.length; i++) {
                Branch branch = branches.findByCode(BRANCH_CODES[i]).orElseThrow();
                Product p = new Product();
                p.setBranchId(branch.getId());
                p.setGroupId(group.getId());
                p.setCategory(categories.findBySlug(g.category()).orElseThrow());
                p.setSku(g.sku());
                p.setName(g.names()[i]);
                String slug = Slugs.slugify(g.names()[i]);
                p.setSlug(products.existsBySlug(slug) ? slug + "-" + branch.getCode().toLowerCase(Locale.ROOT) : slug);
                p.setUnit(g.unit());
                p.setPrice(g.price()[i]);
                if (i == 0) {
                    p.setOldPrice(g.q7OldPrice());
                    p.setBadge(g.q7Badge());
                }
                p.setOrigin("Trại Đồi Nắng · Lâm Đồng");
                p.setRatingAvg(new BigDecimal("4.8"));
                p.setReviewCount(12);
                p.setSoldCount(100 * (GROUPS.length - i));
                p = products.saveAndFlush(p);
                inventory.createRow(branch.getId(), p.getId(), g.stock()[i]);
            }
        }
    }
}
