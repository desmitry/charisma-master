-- Initial schema for Charisma Master

-- Schema for accounts
CREATE SCHEMA IF NOT EXISTS account;

CREATE TABLE IF NOT EXISTS account.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    email TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_users_email_lower ON account.users (LOWER(email));

CREATE TABLE IF NOT EXISTS account.credentials (
    user_id UUID UNIQUE REFERENCES account.users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS account.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS account.user_roles (
    user_id UUID NOT NULL REFERENCES account.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES account.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS account.role_permissions (
    role_id UUID NOT NULL REFERENCES account.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES account.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Tables for app data (prompts, presets, algorithm_weights)
CREATE TABLE IF NOT EXISTS prompts (
    key TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS algorithm_weights (
    id TEXT PRIMARY KEY,
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed roles (do nothing if exists)
INSERT INTO account.roles (name) VALUES
    ('user'),
    ('moderator'),
    ('admin')
ON CONFLICT (name) DO NOTHING;

-- Seed permissions
INSERT INTO account.permissions (name) VALUES
    ('user.profile.view.own'),
    ('user.profile.update.own'),
    ('user.analysis.create'),
    ('user.analysis.view.own'),
    ('user.analysis.delete.own'),
    ('user.profile.view.any'),
    ('user.analysis.view.any'),
    ('content.prompts.manage'),
    ('content.presets.manage'),
    ('content.algorithm_weights.view'),
    ('user.account.delete.any'),
    ('user.analysis.delete.any'),
    ('content.algorithm_weights.manage'),
    ('system.settings.view'),
    ('system.settings.edit')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to user role
INSERT INTO account.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM account.roles r, account.permissions p
WHERE r.name = 'user' AND p.name IN (
    'user.profile.view.own',
    'user.profile.update.own',
    'user.analysis.create',
    'user.analysis.view.own',
    'user.analysis.delete.own'
)
ON CONFLICT DO NOTHING;

-- Assign permissions to moderator role (includes user permissions)
INSERT INTO account.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM account.roles r, account.permissions p
WHERE r.name = 'moderator' AND p.name IN (
    'user.profile.view.own',
    'user.profile.update.own',
    'user.analysis.create',
    'user.analysis.view.own',
    'user.analysis.delete.own',
    'user.profile.view.any',
    'user.analysis.view.any',
    'content.prompts.manage',
    'content.presets.manage',
    'content.algorithm_weights.view'
)
ON CONFLICT DO NOTHING;

-- Assign permissions to admin role (all permissions)
INSERT INTO account.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM account.roles r, account.permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
