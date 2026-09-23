<!-- Keep one concern per pull request. See CONTRIBUTING.md. -->

## What and why

<!-- What changed, and what problem it solves. Link the issue if there is one. -->

Closes #

## Affected modules

<!-- e.g. kira-gateway, kira-ui -->

## Verification

<!-- The command you ran and its result. Backend: ./mvnw.cmd compile in the changed module. -->

```
```

## Contract changes

- [ ] Queue name, routing key, or message DTO between `kira-producer` and `kira-queue`
- [ ] API contract shared with `kira-ui`, `mobile-app`, or another gateway consumer
- [ ] Database migration (additive only — no edits to an applied migration)
- [ ] None of the above

<!-- If any box above is ticked, describe how both sides were inspected. -->

## Checklist

- [ ] Read the target module's `AGENTS.override.md`
- [ ] Scoped to one concern, no unrelated formatting churn
- [ ] Financial amounts use `BigDecimal`; ledger stays append-only and settlement idempotent
- [ ] No secrets, tokens, credentials, or personal data in code, logs, or fixtures
- [ ] Queue work is redelivery-safe; Playwright resources released on every path
- [ ] Screenshots attached for visible UI changes
