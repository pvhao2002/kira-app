package com.matchmind.account;

import com.matchmind.shared.ApiException;
import com.matchmind.security.Principals.UserPrincipal;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountImageControllerTest {
    @Test
    @SuppressWarnings("unchecked")
    void bindsStoredObjectAndSheetPromptToTheSignedInUser() throws Exception {
        var jdbc = mock(JdbcTemplate.class);
        var client = mock(S3Client.class);
        var builder = mock(S3ClientBuilder.class, RETURNS_SELF);
        when(builder.build()).thenReturn(client);
        var owner = new UserPrincipal(UUID.randomUUID(), "a/b", "VIEWER");
        var upload = new MockMultipartFile("file", "../private.txt", "text/plain", new byte[]{-1,-40,-1});
        var api = new AccountImageController(jdbc, "a".repeat(32), "private-bucket", "key", "secret", "https://sheet");
        try (var sdk = mockStatic(S3Client.class)) {
            sdk.when(S3Client::builder).thenReturn(builder);
            var result = api.upload(owner, upload);
            ArgumentCaptor<Consumer<PutObjectRequest.Builder>> request = ArgumentCaptor.forClass(Consumer.class);
            verify(client).putObject(request.capture(), any(RequestBody.class));
            var put = PutObjectRequest.builder();
            request.getValue().accept(put);
            var stored = put.build();
            assertThat(stored.key()).startsWith("MATCHMIND/" + owner.id() + " - a_b/").endsWith("/" + result.importId() + ".jpg");
            assertThat(stored.bucket()).isEqualTo("private-bucket");
            assertThat(stored.contentType()).isEqualTo("image/jpeg");
            verify(jdbc).update("insert into account_images (id,user_id,object_key) values (?,?,?)", result.importId(), owner.id(), stored.key());
            assertThat(result.prompt()).contains(result.importId().toString(), "https://sheet", "ACCOUNT");
        }
    }

    @Test
    void recognizesScreenshotSignaturesAndRejectsText() {
        assertThat(AccountImageController.extension(new byte[]{-119,80,78,71,13,10,26,10})).isEqualTo("png");
        assertThat(AccountImageController.extension(new byte[]{-1,-40,-1})).isEqualTo("jpg");
        assertThatThrownBy(() -> AccountImageController.extension("<svg/>".getBytes())).isInstanceOf(ApiException.class);
    }
}
