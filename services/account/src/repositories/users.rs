use crate::models::users::AuthError;
use async_trait::async_trait;
use sqlx::{Error, PgPool};
use uuid::Uuid;

/// Returns true if the error is a unique constraint violation (e.g., duplicate email).
pub fn is_unique_violation(error: &Error) -> bool {
    matches!(error, Error::Database(db_err) if db_err.constraint().is_some())
}

/// Repository trait for user account operations.
///
/// Defines the interface for interacting with user accounts and credentials
/// in the database. Implementations handle the persistence layer for user
/// management operations.
#[async_trait]
pub trait UsersRepository {
    /// Creates a user account (transactional: inserts into both `users` and `credentials` tables).
    ///
    /// Email is stored as lowercase for case-insensitive uniqueness.
    async fn create(&self, email: String, password_hash: String) -> Result<Uuid, Error>;

    /// Retrieves a user's email by their ID.
    async fn get_by_id(&self, id: Uuid) -> Result<String, Error>;

    /// Retrieves the password hash for a user by their ID.
    ///
    /// Used for password verification when the user ID is already known
    /// (e.g., during password change operations).
    async fn get_password_hash_by_id(&self, id: Uuid) -> Result<String, Error>;

    /// Verifies a user's credentials by email and password.
    ///
    /// Looks up the user by email (case-insensitive) and compares the provided
    /// password against the stored hash using bcrypt.
    ///
    /// # Returns
    /// * `Ok(Uuid)` - The user's ID if credentials are valid.
    /// * `Err(AuthError)` - If the email is not found, password doesn't match, or bcrypt fails.
    async fn verify_password(&self, email: String, password: String) -> Result<Uuid, AuthError>;

    /// Updates a user's email address.
    ///
    /// The new email is stored in lowercase to maintain case-insensitive
    /// uniqueness.
    async fn update_email(&self, id: Uuid, new_email: String) -> Result<(), Error>;

    /// Updates a user's password hash.
    ///
    /// Should be called after verifying the user's old password. The new
    /// password should be hashed with bcrypt before calling this method.
    async fn update_password(&self, id: Uuid, new_password_hash: String) -> Result<(), Error>;

    /// Retrieves a user's roles and permissions by their ID.
    ///
    /// Fetches all roles assigned to the user and flattens all permissions
    /// from those roles into a single list.
    async fn get_permissions_by_id(&self, id: Uuid) -> Result<(Vec<String>, Vec<String>), Error>;

    /// Assigns a role to a user.
    ///
    /// If the role does not exist, this will fail.
    /// If the user already has the role, it will be ignored (ON CONFLICT DO NOTHING).
    async fn assign_role(&self, user_id: Uuid, role_name: String) -> Result<(), Error>;

    /// Removes a role from a user.
    async fn remove_role(&self, user_id: Uuid, role_name: String) -> Result<(), Error>;
}

/// PostgreSQL implementation of the `UsersRepository` trait.
///
/// Uses a connection pool (`PgPool`) for efficient database access.
pub struct PgUsersRepository {
    pool: PgPool,
}

impl PgUsersRepository {
    /// Creates a new `PgUsersRepository` instance.
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UsersRepository for PgUsersRepository {
    async fn create(&self, email: String, password_hash: String) -> Result<Uuid, Error> {
        let mut tx = self.pool.begin().await?;

        let user_id: Uuid = sqlx::query_scalar!(
            r#"INSERT INTO account.users (email) VALUES (LOWER($1)) RETURNING id"#,
            &email
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            r#"INSERT INTO account.credentials (user_id, password_hash) VALUES ($1, $2)"#,
            user_id,
            &password_hash
        )
        .execute(&mut *tx)
        .await?;

        // Assign default 'user' role
        sqlx::query!(
            r#"INSERT INTO account.user_roles (user_id, role_id) SELECT $1, id FROM account.roles WHERE name = 'user' ON CONFLICT DO NOTHING"#,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(user_id)
    }

    async fn get_by_id(&self, id: Uuid) -> Result<String, Error> {
        let email: String =
            sqlx::query_scalar!(r#"SELECT email FROM account.users WHERE id = $1"#, id)
                .fetch_one(&self.pool)
                .await?;
        Ok(email)
    }

    async fn get_password_hash_by_id(&self, id: Uuid) -> Result<String, Error> {
        let password_hash: String = sqlx::query_scalar!(
            r#"SELECT c.password_hash FROM account.credentials c WHERE c.user_id = $1"#,
            id
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(password_hash)
    }

    async fn verify_password(&self, email: String, password: String) -> Result<Uuid, AuthError> {
        let result = sqlx::query!(
            r#"
            SELECT u.id, c.password_hash
            FROM account.users u
            JOIN account.credentials c ON u.id = c.user_id
            WHERE LOWER(u.email) = LOWER($1)
            "#,
            &email
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AuthError::UserNotFound)?;

        match result {
            Some(row) => {
                let is_valid = bcrypt::verify(&password, &row.password_hash)?;
                if is_valid {
                    Ok(row.id)
                } else {
                    Err(AuthError::InvalidPassword)
                }
            }
            None => Err(AuthError::UserNotFound),
        }
    }

    async fn update_email(&self, id: Uuid, new_email: String) -> Result<(), Error> {
        sqlx::query!(
            r#"UPDATE account.users SET email = LOWER($1) WHERE id = $2"#,
            &new_email,
            id
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn update_password(&self, id: Uuid, new_password_hash: String) -> Result<(), Error> {
        sqlx::query!(
            r#"UPDATE account.credentials SET password_hash = $1 WHERE user_id = $2"#,
            &new_password_hash,
            id
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn get_permissions_by_id(&self, id: Uuid) -> Result<(Vec<String>, Vec<String>), Error> {
        // First verify user exists
        let exists: Option<i32> =
            sqlx::query_scalar!(r#"SELECT 1 FROM account.users WHERE id = $1"#, id)
                .fetch_optional(&self.pool)
                .await?
                .flatten();

        if exists.is_none() {
            return Err(Error::RowNotFound);
        }

        // Fetch roles (can be empty if user has no roles)
        let roles: Vec<String> = sqlx::query_scalar!(
            r#"
            SELECT r.name
            FROM account.user_roles ur
            JOIN account.roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1
            "#,
            id
        )
        .fetch_all(&self.pool)
        .await?;

        // Fetch permissions (can be empty if user has no roles)
        let permissions: Vec<String> = sqlx::query_scalar!(
            r#"
            SELECT DISTINCT p.name
            FROM account.user_roles ur
            JOIN account.role_permissions rp ON ur.role_id = rp.role_id
            JOIN account.permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = $1
            "#,
            id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok((roles, permissions))
    }

    async fn assign_role(&self, user_id: Uuid, role_name: String) -> Result<(), Error> {
        sqlx::query!(
            r#"INSERT INTO account.user_roles (user_id, role_id) SELECT $1, id FROM account.roles WHERE name = $2 ON CONFLICT DO NOTHING"#,
            user_id,
            role_name
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn remove_role(&self, user_id: Uuid, role_name: String) -> Result<(), Error> {
        sqlx::query!(
            r#"DELETE FROM account.user_roles WHERE user_id = $1 AND role_id = (SELECT id FROM account.roles WHERE name = $2)"#,
            user_id,
            role_name
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
