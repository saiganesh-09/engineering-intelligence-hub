# Payment Platform Architecture

## Overview

The payment platform processes card transactions for the checkout service.
It consists of the payment-service, ledger-service, and fraud-detection-service.

## Components

### payment-service
Exposes a REST API at `/api/payments`. Validates card details, calls the PSP
(Stripe) for authorization, and writes a pending transaction row to Postgres.

### ledger-service
Consumes `payment.completed` and `payment.failed` events from Kafka topic
`payments.events` and records double-entry bookkeeping entries.

### fraud-detection-service
Scores each authorized payment asynchronously. High-risk payments are flagged
and pushed to the manual review queue.

## Data Flow

1. The checkout service calls `payment-service` synchronously over HTTPS.
2. `payment-service` authorizes with Stripe and persists a pending transaction.
3. On success it publishes `payment.completed` to Kafka.
4. `ledger-service` consumes the event and writes balanced ledger entries.
5. `fraud-detection-service` consumes the same event and scores the payment.

## Failure Modes

- Stripe timeouts exhaust the `payment-service` connection pool — mitigated
  by a circuit breaker and request-level timeout of 3 seconds.
- Kafka consumer lag can replay `payment.completed` events — the ledger
  consumer is idempotent on `transaction_id`.
- Postgres write contention on the transactions table is handled with
  optimistic locking on `version`.
