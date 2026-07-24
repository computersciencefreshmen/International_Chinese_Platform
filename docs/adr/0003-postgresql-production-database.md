# ADR 0003: PostgreSQL as the production database

- Status: Accepted
- Date: 2026-07-20

## Decision

Use Railway PostgreSQL through `pg` with an async connection pool, numbered SQL migrations, native UUID/timestamptz/citext/jsonb types, and explicit transactions. Local development and CI use PostgreSQL 15 as well.

## Consequences

The API remains a modular monolith, but every database operation is asynchronous. State-changing workflows use conditional updates, transactions, and advisory/row locks where concurrency matters. SQLite files and SQLite-only migrations are no longer production inputs.
