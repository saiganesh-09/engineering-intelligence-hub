# Platform API Overview

## Authentication

All service-to-service calls use JWT bearer tokens issued by auth-service.
Tokens carry `sub`, `aud`, `exp`, and `scope` claims and are valid for
15 minutes. The gateway validates tokens against the published JWKS.

## Payment API

| Endpoint | Method | Description |
|---|---|---|
| `/api/payments` | POST | Authorize a payment. Idempotent via `Idempotency-Key` header. |
| `/api/payments/{id}` | GET | Retrieve transaction status (`pending`, `authorized`, `captured`, `failed`). |
| `/api/payments/{id}/capture` | POST | Capture an authorized payment. |
| `/api/payments/{id}/refund` | POST | Full or partial refund. |

### Error model

Errors return RFC 7807 problem details: `type`, `title`, `status`, `detail`,
and `instance`. Transient errors use `type: about:blank` with status 503 —
clients should retry with backoff.

## Ledger API

| Endpoint | Method | Description |
|---|---|---|
| `/api/ledger/entries` | GET | List ledger entries; filter by `account`, `transaction_id`, `since`. |
| `/api/ledger/balances/{account}` | GET | Current balance for an account. |

## Events

| Topic | Event | Producer | Consumers |
|---|---|---|---|
| `payments.events` | `payment.completed` | payment-service | ledger-service, fraud-detection-service |
| `payments.events` | `payment.failed` | payment-service | ledger-service |
| `fraud.events` | `fraud.flagged` | fraud-detection-service | payments-service, notifications-service |
