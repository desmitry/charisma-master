//! NATS-based distributed logger.
//!
//! Sends log messages to a centralized logging service via NATS.
//! Each log message includes the service name, log level, and message content.

use crate::proto::common::Log;
use prost::Message;
use std::sync::Arc;

/// Distributed logger that sends messages via NATS.
///
/// The logger is designed to be cheap to clone (uses `Arc` internally)
/// and can be safely shared across async tasks.
#[derive(Clone)]
pub struct Logger {
    subject: Arc<String>,
    service: Arc<String>,
}

impl Logger {
    /// Creates a new logger instance.
    ///
    /// # Arguments
    /// * `service` - Name of the service (e.g., "account", "api_gateway")
    /// * `subject` - NATS subject to publish log messages to (e.g., "logger")
    pub fn new(service: String, subject: String) -> Self {
        Logger {
            subject: Arc::new(subject),
            service: Arc::new(service),
        }
    }

    /// Sends a log message with the specified level.
    ///
    /// # Arguments
    /// * `lvl` - Log level (e.g., "error", "info", "debug")
    /// * `msg` - The message to log
    /// * `client` - NATS client used to publish the message
    ///
    /// # Returns
    /// * `Ok(())` - If the message was published successfully
    /// * `Err(async_nats::PublishError)` - If publishing failed
    pub async fn log(
        &self,
        lvl: String,
        msg: String,
        client: &Arc<async_nats::Client>,
    ) -> Result<(), async_nats::PublishError> {
        client
            .publish(
                Arc::clone(&self.subject).as_ref().clone(),
                Log {
                    service: Arc::clone(&self.service).as_ref().clone(),
                    level: lvl,
                    message: msg,
                }
                .encode_to_vec()
                .into(),
            )
            .await
    }

    /// Logs an error message.
    pub async fn error(
        &self,
        msg: String,
        client: &Arc<async_nats::Client>,
    ) -> Result<(), async_nats::PublishError> {
        self.log("error".to_string(), msg, client).await
    }

    /// Logs an info message.
    pub async fn info(
        &self,
        msg: String,
        client: &Arc<async_nats::Client>,
    ) -> Result<(), async_nats::PublishError> {
        self.log("info".to_string(), msg, client).await
    }

    /// Logs a warning message.
    pub async fn warn(
        &self,
        msg: String,
        client: &Arc<async_nats::Client>,
    ) -> Result<(), async_nats::PublishError> {
        self.log("warn".to_string(), msg, client).await
    }
}
