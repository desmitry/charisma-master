FROM rust:1.94-alpine AS builder

RUN cargo install sqlx-cli --version=0.8.6 --locked --no-default-features --features rustls,postgres

WORKDIR /app
COPY services/migrator/Cargo.toml /app
COPY services/migrator/Cargo.lock /app
COPY services/migrator/src /app/src
RUN cargo build --release

FROM debian:12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/cargo/bin/sqlx /usr/local/bin/sqlx

COPY --from=builder /app/target/release/migrator-seed /usr/local/bin/migrator-seed

WORKDIR /app
COPY services/migrator/migrations /app/migrations
COPY docs /app/docs

ENTRYPOINT ["/bin/bash", "-c", "sqlx migrate run --source /app/migrations && migrator-seed"]
