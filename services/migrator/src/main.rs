use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
struct Preset {
    id: Option<String>,
    name: String,
    description: Option<String>,
    criteria: serde_json::Value,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://charisma:charisma@postgresql:5432/charisma".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    let project_root = env::var("PROJECT_ROOT").unwrap_or_else(|_| ".".to_string());
    let docs_path = Path::new(&project_root).join("docs");

    seed_prompts(&pool, &docs_path).await?;
    seed_presets(&pool, &docs_path).await?;

    println!("Seed completed successfully!");
    Ok(())
}

async fn seed_prompts(
    pool: &sqlx::Pool<sqlx::Postgres>,
    docs_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let prompts_dir = docs_path.join("prompts");
    if !prompts_dir.exists() {
        println!("Prompts directory not found: {:?}", prompts_dir);
        return Ok(());
    }

    // Regular prompts
    for entry in fs::read_dir(&prompts_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            continue;
        }
        if let Some(ext) = path.extension() {
            if ext == "txt" {
                let stem = path.file_stem().unwrap().to_string_lossy();
                // Skip personas subdir entries if they somehow appear here
                if stem == "personas" {
                    continue;
                }
                let key = stem.to_string();
                let content = fs::read_to_string(&path)?;

                sqlx::query(
                    "INSERT INTO prompts (key, content) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content, updated_at = now()",
                )
                .bind(&key)
                .bind(&content)
                .execute(pool)
                .await?;
                println!("Seeded prompt: {key}");
            }
        }
    }

    // Personas
    let personas_dir = prompts_dir.join("personas");
    if personas_dir.exists() {
        for entry in fs::read_dir(&personas_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                continue;
            }
            if let Some(ext) = path.extension() {
                if ext == "txt" {
                    let stem = path.file_stem().unwrap().to_string_lossy();
                    let key = format!("persona:{stem}");
                    let content = fs::read_to_string(&path)?;

                    sqlx::query(
                        "INSERT INTO prompts (key, content) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content, updated_at = now()",
                    )
                    .bind(&key)
                    .bind(&content)
                    .execute(pool)
                    .await?;
                    println!("Seeded persona: {key}");
                }
            }
        }
    }

    Ok(())
}

async fn seed_presets(
    pool: &sqlx::Pool<sqlx::Postgres>,
    docs_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let presets_dir = docs_path.join("presets");
    if !presets_dir.exists() {
        println!("Presets directory not found: {:?}", presets_dir);
        return Ok(());
    }

    for entry in fs::read_dir(&presets_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            continue;
        }
        if let Some(ext) = path.extension() {
            if ext == "json" {
                let content = fs::read_to_string(&path)?;
                let preset: Preset = serde_json::from_str(&content)?;
                let preset_id = preset
                    .id
                    .unwrap_or_else(|| path.file_stem().unwrap().to_string_lossy().to_string());
                let criteria_json = serde_json::to_string(&preset.criteria)?;

                sqlx::query(
                    "INSERT INTO presets (id, name, description, criteria) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, criteria = EXCLUDED.criteria, updated_at = now()",
                )
                .bind(&preset_id)
                .bind(&preset.name)
                .bind(&preset.description)
                .bind(&criteria_json)
                .execute(pool)
                .await?;
                println!("Seeded preset: {preset_id}");
            }
        }
    }

    Ok(())
}
