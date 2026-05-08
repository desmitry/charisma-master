//! Shared utilities for Magic Market Rust services.
//!
//! This crate provides common functionality used across all Rust microservices:
//!
//! - **Logger**: NATS-based distributed logging
//! - **spawn_nats_handler**: Generic NATS request-reply handler with queue subscriptions
//! - **CancellationToken**: Graceful shutdown signaling
//!
//! ## Usage
//!
//! ```rust
//! use rust_common::logger::Logger;
//! use rust_common::spawn_nats_handlers::spawn_nats_handler;
//! use rust_common::CancellationToken;
//! use std::sync::Arc;
//!
//! let logger = Logger::new("my-service".to_string(), "logger".to_string());
//! let cancel_token = CancellationToken::new();
//! // Use with spawn_nats_handler...
//! ```

pub mod logger;
mod proto;
pub mod spawn_nats_handlers;

pub use tokio_util::sync::CancellationToken;
