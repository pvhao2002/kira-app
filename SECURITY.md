# Security Policy

## Supported Versions

This project is developed as a rolling release from the `main` branch. Only the latest commit on
`main` receives security fixes; there are no maintained release branches.

| Version | Supported |
| --- | --- |
| `main` (latest) | ✅ |
| Older commits / forks | ❌ |

`kira-bank` is a separate, independently versioned repository nested in this one and follows the
same policy.

## Reporting a Vulnerability

**Do not open a public GitHub issue for a security vulnerability.**

Report it privately through either channel:

1. **GitHub Security Advisories** (preferred) — open a draft advisory at
   [Security → Report a vulnerability](https://github.com/pvhao2002/kira-app/security/advisories/new).
2. **Email** — <hideonbush8405@gmail.com> with `SECURITY` in the subject line.

Please include:

- The affected module (e.g. `kira-gateway`, `kira-queue`, `kira-bank-service`) and commit hash.
- The vulnerability class and its impact.
- Minimal reproduction steps or a proof of concept.
- Any suggested mitigation.

Do **not** include real credentials, production data, or third-party personal data in the report.

## What to Expect

| Stage | Target |
| --- | --- |
| Acknowledgement of your report | within 5 business days |
| Initial assessment and severity | within 10 business days |
| Fix or mitigation for accepted high-severity issues | within 30 days where practical |

You will get an update when the assessment is done, when a fix is merged, and when it is released.
If a report is declined, you will be told why. This is a personal, non-commercial project — there
is no bug bounty, but valid reporters are credited in the advisory unless they prefer otherwise.

Please give us a reasonable window to ship a fix before disclosing publicly.

## Scope

In scope:

- Authentication and authorisation flaws (JWT handling, session/cookie handling, ownership checks).
- Injection, deserialization, SSRF, and path-traversal issues in any service.
- Secret or credential leakage through logs, error responses, or API output.
- Integrity flaws in financial logic — ledger mutation, non-idempotent settlement, rounding abuse.
- Vulnerable dependencies with a demonstrable path to exploitation here.

Out of scope:

- Findings that require an already-compromised host or a privileged local account.
- Default development credentials in `.env.example`, `docker-compose.yml`, and other local-only
  configuration — these are documented placeholders, not deployed secrets.
- Denial of service through volumetric traffic.
- Missing hardening headers on the local development stack.
- Automated scanner output with no demonstrated impact.

## Deployment Hardening

If you deploy this stack yourself, you are responsible for the values you run it with. At minimum:

- Replace `APP_SECURITY_JWT_SECRET` with 32+ random bytes; never ship the placeholder.
- Change every default database and broker credential, and do not expose MySQL or the RabbitMQ
  management UI to the public internet.
- Set `APP_SECURITY_COOKIE_SECURE=true` and terminate TLS in front of the stack.
- Restrict `APP_SECURITY_CORS_ALLOWED_ORIGINS` to the origins you actually serve.
- Keep `.env`, `.env.ec2`, and any key material out of version control and off shared storage.
