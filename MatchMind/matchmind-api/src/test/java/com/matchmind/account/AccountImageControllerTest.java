package com.matchmind.account;

import com.matchmind.shared.ApiException;
import com.matchmind.security.Principals.UserPrincipal;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountImageControllerTest {
    @Test
    @SuppressWarnings("unchecked")
    void storesEveryScreenshotUnderOneImportAndReturnsOnePrompt() throws Exception {
        var jdbc = mock(JdbcTemplate.class);
        var client = mock(S3Client.class);
        var builder = mock(S3ClientBuilder.class, RETURNS_SELF);
        when(builder.build()).thenReturn(client);
        var owner = new UserPrincipal(UUID.randomUUID(), "a/b", "VIEWER");
        var jpeg = new MockMultipartFile("file", "../private.txt", "text/plain", new byte[]{-1,-40,-1});
        var png = new MockMultipartFile("file", "b.png", "image/png", new byte[]{-119,80,78,71,13,10,26,10});
        var api = new AccountImageController(jdbc, "a".repeat(32), "private-bucket", "key", "secret", "https://sheet");
        try (var sdk = mockStatic(S3Client.class)) {
            sdk.when(S3Client::builder).thenReturn(builder);
            var result = api.upload(owner, List.of(jpeg, png));
            ArgumentCaptor<Consumer<PutObjectRequest.Builder>> request = ArgumentCaptor.forClass(Consumer.class);
            verify(client, times(2)).putObject(request.capture(), any(RequestBody.class));
            var stored = request.getAllValues().stream().map(c -> { var put = PutObjectRequest.builder(); c.accept(put); return put.build(); }).toList();
            String folder = stored.get(0).key().substring(0, stored.get(0).key().lastIndexOf('/') + 1);
            assertThat(folder).startsWith("MATCHMIND/" + owner.id() + " - a_b/").endsWith("/" + result.importId() + "/");
            assertThat(stored).extracting(PutObjectRequest::key).containsExactly(folder + "1.jpg", folder + "2.png");
            assertThat(stored).extracting(PutObjectRequest::contentType).containsExactly("image/jpeg", "image/png");
            assertThat(stored).extracting(PutObjectRequest::bucket).containsOnly("private-bucket");
            verify(jdbc).update("insert into account_images (id,user_id,object_key) values (?,?,?)", result.importId(), owner.id(), folder);
            assertThat(result.prompt()).contains(result.importId().toString(), "https://sheet", "ACCOUNT", "2 attached screenshots", "once");
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void removesStoredScreenshotsWhenALaterOneFails() throws Exception {
        var client = mock(S3Client.class);
        var builder = mock(S3ClientBuilder.class, RETURNS_SELF);
        when(builder.build()).thenReturn(client);
        when(client.putObject(any(Consumer.class), any(RequestBody.class)))
            .thenReturn(null).thenThrow(SdkException.create("down", null));
        var jpeg = new MockMultipartFile("file", "a.jpg", "image/jpeg", new byte[]{-1,-40,-1});
        var api = new AccountImageController(mock(JdbcTemplate.class), "a".repeat(32), "b", "key", "secret", "https://sheet");
        try (var sdk = mockStatic(S3Client.class)) {
            sdk.when(S3Client::builder).thenReturn(builder);
            assertThatThrownBy(() -> api.upload(new UserPrincipal(UUID.randomUUID(), "u", "VIEWER"), List.of(jpeg, jpeg)))
                .isInstanceOf(ApiException.class);
            verify(client).deleteObject(any(Consumer.class));
        }
    }

    @Test
    void rejectsEmptyAndOversizedBatchesBeforeStoringAnything() {
        var api = new AccountImageController(mock(JdbcTemplate.class), "a".repeat(32), "b", "key", "secret", "https://sheet");
        var owner = new UserPrincipal(UUID.randomUUID(), "u", "VIEWER");
        var jpeg = new MockMultipartFile("file", "a.jpg", "image/jpeg", new byte[]{-1,-40,-1});
        assertThatThrownBy(() -> api.upload(owner, List.of())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> api.upload(owner, Collections.nCopies(11, jpeg))).isInstanceOf(ApiException.class);
    }

    @Test
    void recognizesScreenshotSignaturesAndRejectsText() {
        assertThat(AccountImageController.extension(new byte[]{-119,80,78,71,13,10,26,10})).isEqualTo("png");
        assertThat(AccountImageController.extension(new byte[]{-1,-40,-1})).isEqualTo("jpg");
        assertThatThrownBy(() -> AccountImageController.extension("<svg/>".getBytes())).isInstanceOf(ApiException.class);
    }
}
