# Auth Service Runbook

## Service Overview

auth-service issues and validates JWT access tokens for all internal
service-to-service calls and end-user sessions. It runs three replicas behind
the internal load balancer and depends on Postgres (token store) and Redis
(refresh-token cache + JWKS cache).

## Common Operations

### Rotate signing keys
Keys rotate automatically every 90 days. To force a rotation:

```bash
kubectl exec deploy/auth-service -- ./bin/rotate-keys
```

Verify the new key appears at `https://auth.internal/.well-known/jwks.json`.

### Clear a stuck session
Delete the refresh token from Redis:

```bash
redis-cli DEL "refresh:<session_id>"
```

The user will be asked to re-authenticate on the next token refresh.

## Alerts

| Alert | Meaning | Action |
|---|---|---|
| `auth_jwks_stale` | JWKS older than 25h | Check rotation job logs |
| `auth_login_5xx` | 5xx on /login above 1% | Check Postgres connectivity |
| `auth_redis_down` | Redis unreachable | Failover to replica; tokens still validate via JWKS cache |

## Rollback

Deploys are blue-green. To roll back, re-point the `auth-service` ingress to
the previous deployment revision and invalidate the Redis JWKS cache so the
old key set is re-fetched.
