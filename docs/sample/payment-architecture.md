# Payment Platform Architecture

## Overview
The payment platform processes card transactions for the checkout service.
It consists of the payment-service, ledger-service, and fraud-detection-service.

## Payment Service
The payment-service exposes a REST API at /api/payments. It validates card
details, calls the PSP (Stripe) for authorization, and writes a pending
transaction row to Postgres.

## Communication
The checkout service calls payment-service synchronously over HTTPS using
JSON. The payment-service publishes `payment.completed` and
`payment.failed` events to Kafka topic `payments.events`. The ledger-service
consumes these events to record double-entry bookkeeping.

## Authentication
All internal service calls use JWT tokens issued by the auth-service. The
API gateway validates tokens before forwarding requests downstream.

## Failure Modes
If Stripe authorization times out after 10 seconds, the transaction is
marked `requires_review` and an alert is sent to #payments-oncall.
A known incident (INC-1042) occurred when the Kafka consumer lag caused
duplicate ledger entries.
