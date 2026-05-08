FROM rust:1.94-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache musl-dev openssl-dev protoc

COPY services/account/Cargo.toml ./services/account/Cargo.toml
COPY services/account/Cargo.lock ./services/account/Cargo.lock

COPY packages/rust_common ./packages/rust_common
COPY packages/proto ./packages/proto

COPY services/account/build.rs ./services/account/build.rs

COPY services/account/.sqlx ./services/account/.sqlx

COPY services/account/src ./services/account/src

WORKDIR /usr/src/app/services/account

ENV SQLX_OFFLINE=true
RUN cargo build --release

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /usr/src/app/services/account/target/release/account /usr/local/bin/account

ENV RUST_LOG="info"

USER nonroot
CMD ["/usr/local/bin/account"]
