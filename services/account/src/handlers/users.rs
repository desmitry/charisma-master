use crate::handlers::{log_error, parse_uuid};
use crate::models::users::AuthError;
use crate::proto::account::{credentials, permissions, users};
use crate::proto::common;
use crate::repositories::users::{is_unique_violation, PgUsersRepository, UsersRepository};
use rust_common::logger::Logger;
use sqlx::PgPool;
use std::sync::Arc;

pub async fn create(
    request: users::CreateRequest,
    client: Arc<async_nats::Client>,
    pool: PgPool,
    logger: Logger,
) -> users::CreateResponse {
    let db = PgUsersRepository::new(pool);

    let password_hash = match bcrypt::hash(&request.password, bcrypt::DEFAULT_COST) {
        Ok(hash) => hash,
        Err(e) => {
            log_error(&logger, &client, format!("bcrypt hash failed: {}", e)).await;
            return users::CreateResponse {
                result: Some(users::create_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            };
        }
    };

    match db.create(request.email, password_hash).await {
        Ok(id) => users::CreateResponse {
            result: Some(users::create_response::Result::Success(
                users::CreateSuccess { id: id.to_string() },
            )),
        },
        Err(e) if is_unique_violation(&e) => users::CreateResponse {
            result: Some(users::create_response::Result::EmailExists(
                common::EmailAlreadyRegisteredError {
                    message: "Email already registered".into(),
                },
            )),
        },
        Err(e) => {
            log_error(&logger, &client, format!("create failed: {}", e)).await;
            users::CreateResponse {
                result: Some(users::create_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            }
        }
    }
}

pub async fn verify(
    request: credentials::VerifyRequest,
    client: Arc<async_nats::Client>,
    pool: PgPool,
    logger: Logger,
) -> credentials::VerifyResponse {
    let db = PgUsersRepository::new(pool);

    match db.verify_password(request.email, request.password).await {
        Ok(id) => credentials::VerifyResponse {
            result: Some(credentials::verify_response::Result::Success(
                credentials::VerifySuccess { id: id.to_string() },
            )),
        },
        Err(AuthError::UserNotFound) | Err(AuthError::InvalidPassword) => {
            credentials::VerifyResponse {
                result: Some(credentials::verify_response::Result::InvalidCredentials(
                    common::InvalidCredentialsError {
                        message: "Invalid email or password".into(),
                    },
                )),
            }
        }
        Err(AuthError::BcryptError(e)) => {
            log_error(&logger, &client, format!("bcrypt error: {}", e)).await;
            credentials::VerifyResponse {
                result: Some(credentials::verify_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            }
        }
    }
}

pub async fn get_email_by_id(
    request: users::EmailByIdRequest,
    client: Arc<async_nats::Client>,
    pool: PgPool,
    logger: Logger,
) -> users::EmailByIdResponse {
    let db = PgUsersRepository::new(pool);

    let user_id = match parse_uuid(&request.id) {
        Ok(id) => id,
        Err(e) => {
            log_error(&logger, &client, format!("invalid user ID format: {}", e)).await;
            return users::EmailByIdResponse {
                result: Some(users::email_by_id_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            };
        }
    };

    match db.get_by_id(user_id).await {
        Ok(email) => users::EmailByIdResponse {
            result: Some(users::email_by_id_response::Result::Success(
                users::EmailByIdSuccess { email },
            )),
        },
        Err(sqlx::Error::RowNotFound) => users::EmailByIdResponse {
            result: Some(users::email_by_id_response::Result::UserNotFound(
                common::UserNotFoundError {
                    message: "User not found".into(),
                },
            )),
        },
        Err(e) => {
            log_error(&logger, &client, format!("get_email_by_id failed: {}", e)).await;
            users::EmailByIdResponse {
                result: Some(users::email_by_id_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            }
        }
    }
}

pub async fn update_email(
    request: users::UpdateEmailRequest,
    client: Arc<async_nats::Client>,
    pool: PgPool,
    logger: Logger,
) -> users::UpdateEmailResponse {
    let db = PgUsersRepository::new(pool);

    let user_id = match parse_uuid(&request.id) {
        Ok(id) => id,
        Err(e) => {
            log_error(&logger, &client, format!("invalid user ID format: {}", e)).await;
            return users::UpdateEmailResponse {
                result: Some(users::update_email_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            };
        }
    };

    match db.update_email(user_id, request.new_email).await {
        Ok(()) => users::UpdateEmailResponse {
            result: Some(users::update_email_response::Result::Success(
                users::UpdateEmailSuccess {},
            )),
        },
        Err(e) if is_unique_violation(&e) => users::UpdateEmailResponse {
            result: Some(users::update_email_response::Result::EmailExists(
                common::EmailAlreadyRegisteredError {
                    message: "Email already registered".into(),
                },
            )),
        },
        Err(sqlx::Error::RowNotFound) => users::UpdateEmailResponse {
            result: Some(users::update_email_response::Result::UserNotFound(
                common::UserNotFoundError {
                    message: "User not found".into(),
                },
            )),
        },
        Err(e) => {
            log_error(&logger, &client, format!("update_email failed: {}", e)).await;
            users::UpdateEmailResponse {
                result: Some(users::update_email_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            }
        }
    }
}

pub async fn update_password(
    request: credentials::UpdatePasswordRequest,
    client: Arc<async_nats::Client>,
    pool: PgPool,
    logger: Logger,
) -> credentials::UpdatePasswordResponse {
    let db = PgUsersRepository::new(pool);

    let user_id = match parse_uuid(&request.id) {
        Ok(id) => id,
        Err(e) => {
            log_error(&logger, &client, format!("invalid user ID format: {}", e)).await;
            return credentials::UpdatePasswordResponse {
                result: Some(credentials::update_password_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            };
        }
    };

    let stored_hash = match db.get_password_hash_by_id(user_id).await {
        Ok(hash) => hash,
        Err(sqlx::Error::RowNotFound) => {
            return credentials::UpdatePasswordResponse {
                result: Some(credentials::update_password_response::Result::UserNotFound(
                    common::UserNotFoundError {
                        message: "User not found".into(),
                    },
                )),
            };
        }
        Err(e) => {
            log_error(
                &logger,
                &client,
                format!("get_password_hash_by_id failed: {}", e),
            )
            .await;
            return credentials::UpdatePasswordResponse {
                result: Some(credentials::update_password_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            };
        }
    };

    match bcrypt::verify(&request.old_password, &stored_hash) {
        Ok(true) => {}
        Ok(false) => {
            return credentials::UpdatePasswordResponse {
                result: Some(
                    credentials::update_password_response::Result::InvalidPassword(
                        common::InvalidPasswordError {
                            message: "Invalid password".into(),
                        },
                    ),
                ),
            };
        }
        Err(e) => {
            log_error(&logger, &client, format!("bcrypt verify failed: {}", e)).await;
            return credentials::UpdatePasswordResponse {
                result: Some(credentials::update_password_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            };
        }
    }

    let new_password_hash = match bcrypt::hash(&request.new_password, bcrypt::DEFAULT_COST) {
        Ok(hash) => hash,
        Err(e) => {
            log_error(&logger, &client, format!("bcrypt hash failed: {}", e)).await;
            return credentials::UpdatePasswordResponse {
                result: Some(credentials::update_password_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            };
        }
    };

    match db.update_password(user_id, new_password_hash).await {
        Ok(()) => credentials::UpdatePasswordResponse {
            result: Some(credentials::update_password_response::Result::Success(
                credentials::UpdatePasswordSuccess {},
            )),
        },
        Err(e) => {
            log_error(&logger, &client, format!("update_password failed: {}", e)).await;
            credentials::UpdatePasswordResponse {
                result: Some(credentials::update_password_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            }
        }
    }
}

pub async fn get_permissions_by_id(
    request: permissions::PermissionsByIdRequest,
    client: Arc<async_nats::Client>,
    pool: PgPool,
    logger: Logger,
) -> permissions::PermissionsByIdResponse {
    let db = PgUsersRepository::new(pool);

    let user_id = match parse_uuid(&request.id) {
        Ok(id) => id,
        Err(e) => {
            log_error(&logger, &client, format!("invalid user ID format: {}", e)).await;
            return permissions::PermissionsByIdResponse {
                result: Some(permissions::permissions_by_id_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            };
        }
    };

    match db.get_permissions_by_id(user_id).await {
        Ok((roles, permissions_vec)) => permissions::PermissionsByIdResponse {
            result: Some(permissions::permissions_by_id_response::Result::Success(
                permissions::PermissionsByIdSuccess {
                    roles,
                    permissions: permissions_vec,
                },
            )),
        },
        Err(sqlx::Error::RowNotFound) => permissions::PermissionsByIdResponse {
            result: Some(
                permissions::permissions_by_id_response::Result::UserNotFound(
                    common::UserNotFoundError {
                        message: "User not found".into(),
                    },
                ),
            ),
        },
        Err(e) => {
            log_error(
                &logger,
                &client,
                format!("get_permissions_by_id failed: {}", e),
            )
            .await;
            permissions::PermissionsByIdResponse {
                result: Some(permissions::permissions_by_id_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            }
        }
    }
}

pub async fn assign_role(
    request: users::AssignRoleRequest,
    client: Arc<async_nats::Client>,
    pool: PgPool,
    logger: Logger,
) -> users::AssignRoleResponse {
    let db = PgUsersRepository::new(pool);

    let user_id = match parse_uuid(&request.user_id) {
        Ok(id) => id,
        Err(e) => {
            log_error(&logger, &client, format!("invalid user ID format: {}", e)).await;
            return users::AssignRoleResponse {
                result: Some(users::assign_role_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            };
        }
    };

    match db.assign_role(user_id, request.role_name).await {
        Ok(()) => users::AssignRoleResponse {
            result: Some(users::assign_role_response::Result::Success(
                users::AssignRoleSuccess {},
            )),
        },
        Err(sqlx::Error::RowNotFound) => users::AssignRoleResponse {
            result: Some(users::assign_role_response::Result::UserNotFound(
                common::UserNotFoundError {
                    message: "User not found".into(),
                },
            )),
        },
        Err(e) => {
            log_error(&logger, &client, format!("assign_role failed: {}", e)).await;
            users::AssignRoleResponse {
                result: Some(users::assign_role_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            }
        }
    }
}

pub async fn remove_role(
    request: users::RemoveRoleRequest,
    client: Arc<async_nats::Client>,
    pool: PgPool,
    logger: Logger,
) -> users::RemoveRoleResponse {
    let db = PgUsersRepository::new(pool);

    let user_id = match parse_uuid(&request.user_id) {
        Ok(id) => id,
        Err(e) => {
            log_error(&logger, &client, format!("invalid user ID format: {}", e)).await;
            return users::RemoveRoleResponse {
                result: Some(users::remove_role_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            };
        }
    };

    match db.remove_role(user_id, request.role_name).await {
        Ok(()) => users::RemoveRoleResponse {
            result: Some(users::remove_role_response::Result::Success(
                users::RemoveRoleSuccess {},
            )),
        },
        Err(sqlx::Error::RowNotFound) => users::RemoveRoleResponse {
            result: Some(users::remove_role_response::Result::UserNotFound(
                common::UserNotFoundError {
                    message: "User not found".into(),
                },
            )),
        },
        Err(e) => {
            log_error(&logger, &client, format!("remove_role failed: {}", e)).await;
            users::RemoveRoleResponse {
                result: Some(users::remove_role_response::Result::Internal(
                    common::InternalError {
                        message: "Internal error".into(),
                    },
                )),
            }
        }
    }
}
