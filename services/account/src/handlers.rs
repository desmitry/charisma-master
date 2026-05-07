//! Request handlers for NATS messages.
//!
//! Each handler parses a protobuf request, calls the repository layer,
//! and returns a protobuf response. Errors are logged and converted to
//! generic error messages.

pub mod users;

pub mod helpers;

// Re-export helpers for convenience
pub use helpers::{log_error, parse_uuid};
