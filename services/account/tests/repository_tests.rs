//! Unit tests for the UsersRepository implementation.
//!
//! Tests use #[sqlx::test] for automatic database isolation.
//! Each test gets its own database with migrations run automatically.

use account_service::models::users::AuthError;
use account_service::repositories::users::{PgUsersRepository, UsersRepository};
use uuid::Uuid;

/// Test: Creating a user successfully returns a UUID.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_create_user_success(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email = format!("test{}@example.com", Uuid::new_v4());
    let password_hash = bcrypt::hash("password123", bcrypt::DEFAULT_COST).unwrap();

    let result = repo.create(email.clone(), password_hash).await;

    assert!(result.is_ok(), "create should succeed");
    let user_id = result.unwrap();
    assert_ne!(user_id, Uuid::nil());
}

/// Test: Creating a user with duplicate email fails.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_create_duplicate_email_fails(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email = format!("test{}@example.com", Uuid::new_v4());
    let password_hash = bcrypt::hash("password123", bcrypt::DEFAULT_COST).unwrap();

    assert!(repo
        .create(email.clone(), password_hash.clone())
        .await
        .is_ok());

    let result = repo.create(email, password_hash).await;
    assert!(result.is_err(), "duplicate email should fail");
}

/// Test: Getting a user by ID returns the email.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_get_by_id_success(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email = format!("test{}@example.com", Uuid::new_v4());
    let password_hash = bcrypt::hash("password123", bcrypt::DEFAULT_COST).unwrap();
    let user_id = repo.create(email.clone(), password_hash).await.unwrap();

    let retrieved_email = repo.get_by_id(user_id).await;
    assert!(retrieved_email.is_ok());
    assert_eq!(retrieved_email.unwrap(), email);
}

/// Test: Getting a non-existent user by ID fails.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_get_by_id_not_found(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);

    let result = repo.get_by_id(Uuid::new_v4()).await;
    assert!(result.is_err(), "non-existent user should fail");
}

/// Test: Verifying password with correct credentials succeeds.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_verify_password_success(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email = format!("test{}@example.com", Uuid::new_v4());
    let password = "correct_password";
    let password_hash = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
    repo.create(email.clone(), password_hash).await.unwrap();

    let result = repo
        .verify_password(email.clone(), password.to_string())
        .await;
    assert!(result.is_ok(), "correct password should verify");
    let user_id = result.unwrap();
    assert_ne!(user_id, Uuid::nil());
}

/// Test: Verifying password with wrong password fails.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_verify_password_wrong_password(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email = format!("test{}@example.com", Uuid::new_v4());
    let password_hash = bcrypt::hash("correct_password", bcrypt::DEFAULT_COST).unwrap();
    repo.create(email.clone(), password_hash).await.unwrap();

    let result = repo
        .verify_password(email, "wrong_password".to_string())
        .await;
    assert!(result.is_err());

    match result {
        Err(AuthError::InvalidPassword) => {}
        _ => panic!("expected InvalidPassword error"),
    }
}

/// Test: Verifying password for non-existent user fails.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_verify_password_nonexistent_user(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);

    let result = repo
        .verify_password(
            format!("test{}@example.com", Uuid::new_v4()),
            "password".to_string(),
        )
        .await;
    assert!(result.is_err());

    match result {
        Err(AuthError::UserNotFound) => {}
        _ => panic!("expected UserNotFound error"),
    }
}

/// Test: Updating email successfully changes the email.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_update_email_success(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email = format!("test{}@example.com", Uuid::new_v4());
    let password_hash = bcrypt::hash("password123", bcrypt::DEFAULT_COST).unwrap();
    let user_id = repo.create(email.clone(), password_hash).await.unwrap();

    let new_email = format!("test{}@example.com", Uuid::new_v4());
    let result = repo.update_email(user_id, new_email.clone()).await;
    assert!(result.is_ok(), "update email should succeed");

    let retrieved_email = repo.get_by_id(user_id).await.unwrap();
    assert_eq!(retrieved_email, new_email);
}

/// Test: Updating email to existing email fails.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_update_email_duplicate_fails(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email1 = format!("test1{}@example.com", Uuid::new_v4());
    let email2 = format!("test2{}@example.com", Uuid::new_v4());
    let password_hash = bcrypt::hash("password123", bcrypt::DEFAULT_COST).unwrap();

    let user_id1 = repo.create(email1, password_hash.clone()).await.unwrap();
    repo.create(email2.clone(), password_hash).await.unwrap();

    let result = repo.update_email(user_id1, email2).await;
    assert!(result.is_err(), "updating to duplicate email should fail");
}

/// Test: Updating password successfully changes the password.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_update_password_success(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email = format!("test{}@example.com", Uuid::new_v4());
    let old_password = "old_password";
    let new_password = "new_password";
    let password_hash = bcrypt::hash(old_password, bcrypt::DEFAULT_COST).unwrap();
    let user_id = repo.create(email.clone(), password_hash).await.unwrap();

    let new_password_hash = bcrypt::hash(new_password, bcrypt::DEFAULT_COST).unwrap();
    let result = repo.update_password(user_id, new_password_hash).await;
    assert!(result.is_ok(), "update password should succeed");

    let verify_result = repo
        .verify_password(email.clone(), old_password.to_string())
        .await;
    assert!(verify_result.is_err());

    let verify_result = repo.verify_password(email, new_password.to_string()).await;
    assert!(verify_result.is_ok());
}

/// Test: Getting permissions by ID returns default 'user' role for new users.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_get_permissions_no_roles(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email = format!("test{}@example.com", Uuid::new_v4());
    let password_hash = bcrypt::hash("password123", bcrypt::DEFAULT_COST).unwrap();
    let user_id = repo.create(email, password_hash).await.unwrap();

    let (roles, permissions) = repo.get_permissions_by_id(user_id).await.unwrap();
    assert_eq!(roles, vec!["user".to_string()]);
    assert!(!permissions.is_empty(), "user role should have permissions");
}

/// Test: Getting permissions by ID for non-existent user returns UserNotFoundError.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_get_permissions_nonexistent_user(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);

    let result = repo.get_permissions_by_id(Uuid::new_v4()).await;
    assert!(result.is_err(), "non-existent user should return error");
    assert!(
        matches!(result, Err(sqlx::Error::RowNotFound)),
        "should be RowNotFound"
    );
}

/// Test: Getting password hash by ID succeeds.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_get_password_hash_by_id_success(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email = format!("test{}@example.com", Uuid::new_v4());
    let password_hash = bcrypt::hash("password123", bcrypt::DEFAULT_COST).unwrap();
    let user_id = repo.create(email, password_hash.clone()).await.unwrap();

    let retrieved_hash = repo.get_password_hash_by_id(user_id).await;
    assert!(retrieved_hash.is_ok());
    assert_eq!(retrieved_hash.unwrap(), password_hash);
}

/// Test: Getting password hash for non-existent user fails.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_get_password_hash_by_id_not_found(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);

    let result = repo.get_password_hash_by_id(Uuid::new_v4()).await;
    assert!(result.is_err(), "non-existent user should fail");
}

/// Test: Email is stored as lowercase (case-insensitive uniqueness).
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_email_lowercase_on_create(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email_upper = "Test@Example.com".to_string();
    let password_hash = bcrypt::hash("password123", bcrypt::DEFAULT_COST).unwrap();

    let result = repo.create(email_upper.clone(), password_hash).await;
    assert!(result.is_ok());

    let user_id = result.unwrap();
    let stored_email = repo.get_by_id(user_id).await.unwrap();
    assert_eq!(stored_email, "test@example.com");
}

/// Test: Email is case-insensitive when verifying.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_verify_case_insensitive_email(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool);
    let email = "test@example.com".to_string();
    let password = "password123";
    let password_hash = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
    repo.create(email, password_hash).await.unwrap();

    let result = repo
        .verify_password("TEST@EXAMPLE.COM".to_string(), password.to_string())
        .await;
    assert!(
        result.is_ok(),
        "email verification should be case-insensitive"
    );
}

/// Test: Getting permissions for user with additional roles.
#[sqlx::test(migrations = "../migrator/migrations")]
async fn test_get_permissions_with_roles(pool: sqlx::PgPool) {
    let repo = PgUsersRepository::new(pool.clone());
    let email = format!("test{}@example.com", Uuid::new_v4());
    let password_hash = bcrypt::hash("password123", bcrypt::DEFAULT_COST).unwrap();
    let user_id = repo.create(email, password_hash).await.unwrap();

    // Assign moderator role
    repo.assign_role(user_id, "moderator".to_string())
        .await
        .unwrap();

    let (roles, permissions) = repo.get_permissions_by_id(user_id).await.unwrap();
    assert!(roles.contains(&"user".to_string()));
    assert!(roles.contains(&"moderator".to_string()));
    assert!(
        !permissions.is_empty(),
        "should have permissions from both roles"
    );
}
