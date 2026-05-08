use thiserror::Error;

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("user not found")]
    UserNotFound,
    #[error("invalid password")]
    InvalidPassword,
    #[error("bcrypt error: {0}")]
    BcryptError(#[from] bcrypt::BcryptError),
}
