package com.db.kiragateway.service;

import com.db.kiragateway.config.export.KiraCrawlExportProperties;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class KiraCrawlExportService {

    private final KiraCrawlExportProperties props;

    public KiraCrawlExportService(KiraCrawlExportProperties props) {
        this.props = props;
    }

    public boolean isExportEnabled() {
        return props.isEnabled();
    }

    /**
     * Verifies that export is enabled and {@code source-directory} exists and is readable.
     *
     * @throws IllegalStateException if disabled, unset path, or not a directory
     * @throws IOException          if the path cannot be resolved on the filesystem
     */
    public void validateExportConfiguration() throws IOException {
        resolveCanonicalExportRoot();
    }

    /**
     * Streams a zip of the configured {@code kira-crawl} directory to {@code out}.
     *
     * @throws IllegalStateException if not enabled, path missing/invalid, or not a directory
     */
    public void writeZipArchive(OutputStream out) throws IOException {
        Path canonicalRoot = resolveCanonicalExportRoot();

        try (ZipOutputStream zos = new ZipOutputStream(out)) {
            Files.walkFileTree(canonicalRoot, new SimpleFileVisitor<Path>() {

                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                    Path relative = canonicalRoot.relativize(dir);
                    if (relative.getNameCount() > 0 && shouldExcludeRelativePath(relative)) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) {
                        return FileVisitResult.CONTINUE;
                    }
                    Path relative = canonicalRoot.relativize(file);
                    if (shouldExcludeRelativePath(relative)) {
                        return FileVisitResult.CONTINUE;
                    }
                    if (!isUnderRoot(canonicalRoot, file)) {
                        return FileVisitResult.CONTINUE;
                    }

                    String entryName = relative.toString().replace('\\', '/');
                    zos.putNextEntry(new ZipEntry(entryName));
                    try (InputStream in = Files.newInputStream(file)) {
                        in.transferTo(zos);
                    }
                    zos.closeEntry();
                    return FileVisitResult.CONTINUE;
                }
            });
        }
    }

    private Path resolveCanonicalExportRoot() throws IOException {
        if (!props.isEnabled()) {
            throw new IllegalStateException("export is disabled");
        }
        if (!StringUtils.hasText(props.getSourceDirectory())) {
            throw new IllegalStateException("source-directory is not configured");
        }

        Path root = Path.of(props.getSourceDirectory()).toAbsolutePath().normalize();
        if (!Files.exists(root) || !Files.isDirectory(root)) {
            throw new IllegalStateException("source-directory does not exist or is not a directory: " + root);
        }

        return root.toRealPath();
    }

    private boolean shouldExcludeRelativePath(Path relative) {
        for (int i = 0; i < relative.getNameCount(); i++) {
            String segment = relative.getName(i).toString();
            if ("target".equals(segment)) {
                return true;
            }
            if (".idea".equals(segment)) {
                return true;
            }
            if (".git".equals(segment) && !props.isIncludeGit()) {
                return true;
            }
        }
        return false;
    }

    private boolean isUnderRoot(Path canonicalRoot, Path candidate) throws IOException {
        Path realCandidate = candidate.toRealPath();
        return realCandidate.startsWith(canonicalRoot);
    }
}
