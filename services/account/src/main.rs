mod handlers;
mod models;
mod proto;
mod repositories;

use actix_web::{web, App, HttpResponse, HttpServer};
use rust_common::logger::Logger;
use rust_common::spawn_nats_handlers::spawn_nats_handler;
use rust_common::CancellationToken;
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::signal::unix::{signal, SignalKind};
use tokio::sync::RwLock;

const HEALTH_PORT: u16 = 8080;

/// Configuration for the account service.
struct Config {
    database_url: String,
    nats_url: String,
    max_concurrent_requests: usize,
    max_connections: u32,
    acquire_timeout_secs: u64,
}

impl Config {
    /// Loads configuration from environment variables.
    ///
    /// # Errors
    /// Returns an error if `DATABASE_URL` is not set.
    fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        let database_url =
            env::var("DATABASE_URL").map_err(|_| "DATABASE_URL environment variable not set")?;
        let nats_url = env::var("NATS_URL").unwrap_or_else(|_| "nats://localhost:4222".to_string());
        let max_concurrent_requests = env::var("MAX_CONCURRENT_REQUESTS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1000);
        let max_connections = env::var("DB_MAX_CONNECTIONS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5);
        let acquire_timeout_secs = env::var("DB_ACQUIRE_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5);

        Ok(Self {
            database_url,
            nats_url,
            max_concurrent_requests,
            max_connections,
            acquire_timeout_secs,
        })
    }
}

struct AppState {
    db_connected: RwLock<bool>,
    nats_connected: RwLock<bool>,
}

impl AppState {
    fn new() -> Self {
        Self {
            db_connected: RwLock::new(false),
            nats_connected: RwLock::new(false),
        }
    }

    async fn is_healthy(&self) -> bool {
        *self.db_connected.read().await && *self.nats_connected.read().await
    }
}

async fn health(state: web::Data<Arc<AppState>>) -> HttpResponse {
    if state.is_healthy().await {
        HttpResponse::Ok().json(serde_json::json!({
            "status": "healthy",
            "db": true,
            "nats": true
        }))
    } else {
        let db = *state.db_connected.read().await;
        let nats = *state.nats_connected.read().await;
        HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "status": "unhealthy",
            "db": db,
            "nats": nats
        }))
    }
}

async fn start_health_server(state: Arc<AppState>, cancel_token: CancellationToken) {
    let addr = SocketAddr::from(([0, 0, 0, 0], HEALTH_PORT));

    let server_state = state.clone();
    let cancel_token_clone = cancel_token.clone();

    tokio::spawn(async move {
        let srv = HttpServer::new(move || {
            App::new()
                .app_data(web::Data::new(server_state.clone()))
                .route("/health", web::get().to(health))
        })
        .bind(addr)
        .unwrap()
        .shutdown_timeout(5)
        .run();

        let srv_handle = srv.handle();

        tokio::spawn(async move {
            cancel_token_clone.cancelled().await;
            srv_handle.stop(true).await;
        });

        if let Err(e) = srv.await {
            eprintln!("Health server error: {}", e);
        }
    });
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::from_env()?;
    let cancel_token = CancellationToken::new();

    // Create shared application state for health checks
    let app_state = Arc::new(AppState::new());

    // Start health endpoint server
    let health_cancel_token = cancel_token.clone();
    let health_state = app_state.clone();
    tokio::spawn(async move {
        start_health_server(health_state, health_cancel_token).await;
    });

    // Setup signal handlers for graceful shutdown
    let ct = cancel_token.clone();
    tokio::spawn(async move {
        let mut sigterm = signal(SignalKind::terminate()).unwrap();
        let mut sigint = signal(SignalKind::interrupt()).unwrap();
        tokio::select! {
            _ = sigterm.recv() => ct.cancel(),
            _ = sigint.recv() => ct.cancel(),
        }
    });

    let pool = PgPoolOptions::new()
        .max_connections(config.max_connections)
        .acquire_timeout(Duration::from_secs(config.acquire_timeout_secs))
        .connect(&config.database_url)
        .await?;

    // Update health status for DB
    *app_state.db_connected.write().await = true;

    let client = async_nats::connect_with_options(
        &config.nats_url,
        async_nats::ConnectOptions::new().retry_on_initial_connect(),
    )
    .await?;

    let logger = Logger::new("account".to_string(), "logger".to_string());
    let client = Arc::new(client);

    // Update health status for NATS
    *app_state.nats_connected.write().await = true;

    let handlers = [
        spawn_nats_handler(
            client.clone(),
            "account.users.create",
            handlers::users::create,
            pool.clone(),
            logger.clone(),
            cancel_token.clone(),
            config.max_concurrent_requests,
        ),
        spawn_nats_handler(
            client.clone(),
            "account.users.verify",
            handlers::users::verify,
            pool.clone(),
            logger.clone(),
            cancel_token.clone(),
            config.max_concurrent_requests,
        ),
        spawn_nats_handler(
            client.clone(),
            "account.users.email.by_id",
            handlers::users::get_email_by_id,
            pool.clone(),
            logger.clone(),
            cancel_token.clone(),
            config.max_concurrent_requests,
        ),
        spawn_nats_handler(
            client.clone(),
            "account.users.update.email",
            handlers::users::update_email,
            pool.clone(),
            logger.clone(),
            cancel_token.clone(),
            config.max_concurrent_requests,
        ),
        spawn_nats_handler(
            client.clone(),
            "account.users.update.password",
            handlers::users::update_password,
            pool.clone(),
            logger.clone(),
            cancel_token.clone(),
            config.max_concurrent_requests,
        ),
        spawn_nats_handler(
            client.clone(),
            "account.users.permissions.get",
            handlers::users::get_permissions_by_id,
            pool.clone(),
            logger.clone(),
            cancel_token.clone(),
            config.max_concurrent_requests,
        ),
        spawn_nats_handler(
            client.clone(),
            "account.users.role.assign",
            handlers::users::assign_role,
            pool.clone(),
            logger.clone(),
            cancel_token.clone(),
            config.max_concurrent_requests,
        ),
        spawn_nats_handler(
            client.clone(),
            "account.users.role.remove",
            handlers::users::remove_role,
            pool.clone(),
            logger.clone(),
            cancel_token.clone(),
            config.max_concurrent_requests,
        ),
    ];

    println!(
        "Account service started (max concurrent: {})",
        config.max_concurrent_requests
    );

    // Wait for shutdown signal or handler error
    tokio::select! {
        _ = cancel_token.cancelled() => {
            println!("Shutdown signal received, waiting for in-flight requests...");
        }
        result = futures::future::try_join_all(handlers) => {
            if let Err(e) = result {
                eprintln!("Handler error: {}", e);
            }
        }
    }

    // Graceful shutdown timeout - give in-flight requests time to complete
    tokio::time::sleep(Duration::from_secs(5)).await;
    println!("Shutdown complete");

    Ok(())
}
