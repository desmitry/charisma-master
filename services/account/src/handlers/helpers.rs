//! Helper functions for handlers.

use rust_common::logger::Logger;
use std::sync::Arc;

/// Logs an error to the logger service, falling back to stderr if logging fails.
pub async fn log_error(logger: &Logger, client: &Arc<async_nats::Client>, message: String) {
    if let Err(e) = logger.error(message.clone(), client).await {
        eprintln!("Logger failed: {}; original message: {}", e, message);
    }
}

/// Parses a UUID string, returning an error message on failure.
pub fn parse_uuid(id: &str) -> Result<uuid::Uuid, &'static str> {
    id.parse::<uuid::Uuid>().map_err(|_| "invalid UUID format")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_uuid_valid() {
        let uuid_str = "550e8400-e29b-41d4-a716-446655440000";
        let result = parse_uuid(uuid_str);
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_uuid_invalid() {
        let result = parse_uuid("not-a-uuid");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "invalid UUID format");
    }
}
