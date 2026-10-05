# Platform Troubleshooting Guide

## Symptom: 502/504 at the API Gateway

The gateway timed out waiting for an upstream service.

1. Check which service errored in the `upstream` field of the gateway log.
2. Check that service's `/healthz` — a red health endpoint means the service
   itself is down, not the network.
3. Common cause: connection pool exhaustion during a third-party outage.
   Look for `pool exhausted` in service logs and check the circuit-breaker
   dashboard.

## Symptom: Duplicate ledger entries

Usually means a Kafka consumer replayed events.

1. Check consumer lag: `kafka-consumer-groups --describe --group ledger`.
2. Confirm idempotency — every event must carry a `transaction_id`; the
   consumer dedupes on it. Missing ids mean the producer contract broke.
3. See incident "Duplicate ledger entries after Kafka consumer lag" for the
   historical root cause.

## Symptom: Sudden 401s across services

Service-to-service JWT validation is failing.

1. Check the JWKS endpoint — a stale or missing key set is the usual cause.
2. Verify the signing key rotation job ran (`auth_jwks_stale` alert).
3. If keys rotated correctly, flush Redis JWKS caches on the gateway.

## Symptom: Payments stuck in `pending`

The Stripe authorization call never completed.

1. Check `payment-service` logs for `stripe_timeout` or `circuit_open`.
2. Query the transaction row — if `psp_reference` is null, the call never
   reached Stripe and the transaction can be safely retried.
3. During a confirmed Stripe outage, enable the failover PSP endpoint.
