package app.auto.be.kiratoolservice.util;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.Margin;
import lombok.experimental.UtilityClass;

@UtilityClass
public class PdfUtil {
    public byte[] printPdf(Page page) {
        return page.pdf(new Page.PdfOptions()
                .setFormat("A4")
                .setPrintBackground(true)
                .setMargin(new Margin()
                        .setTop("10mm")
                        .setBottom("10mm")
                        .setLeft("10mm")
                        .setRight("10mm")
                )
        );
    }

}
