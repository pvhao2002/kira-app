package com.kira.farm.identity.application;

/** Delivers the reset link to the user. No SMTP yet: see the two implementations. */
public interface PasswordResetNotifier {
    /** link contains the raw one-time token; implementations must not log it outside development. */
    void sendResetLink(String email, String link);
}
