//! Generic NATS request-reply handler with bounded concurrency and graceful shutdown.
//!
//! Provides a production-ready way to spawn NATS message handlers that:
//! - Subscribe to a subject with queue grouping for load balancing
//! - Decode protobuf requests
//! - Call handler functions with bounded concurrency (semaphore)
//! - Encode and publish responses
//! - Support graceful shutdown via `CancellationToken`
//!
//! Queue subscriptions use the format `q_{subject}` for automatic load balancing
//! across multiple service instances.

use crate::logger::Logger;
use crate::proto::common::SerializationError;
use futures::StreamExt;
use prost::Message;
use std::future::Future;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;

/// Default queue timeout in seconds.
const DEFAULT_QUEUE_TIMEOUT_SECS: u64 = 5;

/// Spawns a NATS handler task with bounded concurrency and graceful shutdown.
///
/// This function creates a new async task that:
/// 1. Subscribes to the specified subject with a queue group
/// 2. Waits for semaphore permit (with timeout) before processing
/// 3. Decodes incoming protobuf messages
/// 4. Calls the provided handler function
/// 5. Sends back the response to the reply subject
/// 6. Shuts down gracefully when `CancellationToken` is cancelled
///
/// # Type Parameters
/// * `F` - Handler function type (must be `Clone`, not `Copy`)
/// * `Fut` - Handler future return type
/// * `Req` - Request message type (must implement `prost::Message`)
/// * `Res` - Response type with oneof result (must implement `prost::Message`)
/// * `Pool` - Database pool or similar shared resource (must be cloneable)
///
/// # Arguments
/// * `client` - NATS client for subscribing and publishing
/// * `subject` - Subject to subscribe to (e.g., "account.users.create")
/// * `handler` - Function that processes requests and returns responses
/// * `pool` - Shared resource (e.g., database connection pool)
/// * `logger` - Logger for error reporting
/// * `cancel_token` - Token for graceful shutdown signaling
/// * `max_concurrent` - Maximum concurrent requests (default: 1000)
///
/// # Returns
/// A `JoinHandle` for the spawned task
///
/// # Backpressure
/// When `max_concurrent` requests are in-flight, new requests wait up to
/// `queue_timeout_secs` for a slot. If timeout expires, a serialization
/// error is returned to the caller.
///
/// # Panics
/// Panics if queue subscription fails (typically due to NATS connection issues)
pub fn spawn_nats_handler<F, Fut, Req, Res, Pool>(
    client: Arc<async_nats::Client>,
    subject: &'static str,
    handler: F,
    pool: Pool,
    logger: Logger,
    cancel_token: CancellationToken,
    max_concurrent: usize,
) -> tokio::task::JoinHandle<()>
where
    F: Fn(Req, Arc<async_nats::Client>, Pool, Logger) -> Fut + Send + Sync + Clone + 'static,
    Fut: Future<Output = Res> + Send,
    Req: prost::Message + Send + Sync + Default + 'static,
    Res: prost::Message + Send + Sync,
    Pool: Send + Clone + Sync + 'static,
{
    tokio::spawn(async move {
        let queue_name = format!("q_{}", subject);
        let mut sub = match client.queue_subscribe(subject, queue_name).await {
            Ok(sub) => sub,
            Err(e) => {
                let _ = logger
                    .error(
                        format!("Failed to subscribe to {}: {}", subject, e),
                        &client,
                    )
                    .await;
                return;
            }
        };

        let semaphore = Arc::new(Semaphore::new(max_concurrent));
        let queue_timeout = Duration::from_secs(DEFAULT_QUEUE_TIMEOUT_SECS);

        loop {
            // Check for shutdown before waiting for messages
            if cancel_token.is_cancelled() {
                let _ = logger
                    .info(format!("Shutting down handler for {}", subject), &client)
                    .await;
                break;
            }

            // Wait for message or shutdown
            let msg = tokio::select! {
                msg = sub.next() => match msg {
                    Some(m) => m,
                    None => break, // Subscription closed
                },
                _ = cancel_token.cancelled() => {
                    let _ = logger
                        .info(format!("Shutting down handler for {}", subject), &client)
                        .await;
                    break;
                }
            };

            let reply_to = msg.reply.clone();
            let request = match Message::decode(msg.payload) {
                Ok(request) => request,
                Err(e) => {
                    let _ = logger
                        .error(
                            format!("Failed to decode message on {}: {}", subject, e),
                            &client,
                        )
                        .await;
                    if let Some(reply) = &reply_to {
                        let _ = client
                            .publish(reply.clone(), SerializationError {}.encode_to_vec().into())
                            .await;
                    }
                    continue;
                }
            };

            // Acquire semaphore permit with timeout (backpressure)
            let permit = match tokio::time::timeout(
                queue_timeout,
                semaphore.clone().acquire_owned(),
            )
            .await
            {
                Ok(Ok(p)) => p,
                Ok(Err(_)) => {
                    // Semaphore closed, shutting down
                    break;
                }
                Err(_) => {
                    let _ = logger
                        .warn(
                            format!("Queue timeout for {}, max concurrent reached", subject),
                            &client,
                        )
                        .await;
                    if let Some(reply) = &reply_to {
                        let _ = client
                            .publish(reply.clone(), SerializationError {}.encode_to_vec().into())
                            .await;
                    }
                    continue;
                }
            };

            let pool_clone = pool.clone();
            let logger_for_task = logger.clone();
            let client_clone = client.clone();
            let handler_clone = handler.clone();

            tokio::task::spawn(async move {
                // Permit is released when this guard goes out of scope
                let _permit = permit;

                let client_for_handler = Arc::clone(&client_clone);
                let response = handler_clone(
                    request,
                    client_for_handler,
                    pool_clone,
                    logger_for_task.clone(),
                )
                .await;

                if let Some(reply) = reply_to {
                    let encoded = response.encode_to_vec();
                    if let Err(e) = client_clone.publish(reply, encoded.into()).await {
                        let _ = logger_for_task
                            .error(format!("Failed to publish response: {}", e), &client_clone)
                            .await;
                    }
                }
            });
        }
    })
}
