-- =============================================================================
-- CENTRAL AUTH SERVER - PostgreSQL DDL
-- Compatible: PostgreSQL 9.6+
-- Convention: SERIAL identity (no UUID), snake_case tables
-- =============================================================================

-- -----------------------------------------------------------------------
-- SCHEMA SETUP
-- -----------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
SET search_path TO auth, public;

-- -----------------------------------------------------------------------
-- APPLICATIONS (registered OAuth2 clients)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.applications (
    id                  SERIAL          PRIMARY KEY,
    app_key             VARCHAR(100)    NOT NULL UNIQUE,   -- e.g. 'pms', 'salespro'
    app_name            VARCHAR(200)    NOT NULL,
    client_id           VARCHAR(200)    NOT NULL UNIQUE,
    client_secret_hash  VARCHAR(255)    NOT NULL,          -- bcrypt hashed
    redirect_uris       TEXT            NOT NULL,          -- JSON array of allowed URIs
    allowed_scopes      VARCHAR(500)    NOT NULL DEFAULT 'openid profile email',
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------
-- ROLES
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.roles (
    id          SERIAL          PRIMARY KEY,
    role_name   VARCHAR(100)    NOT NULL UNIQUE,
    description VARCHAR(500),
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------
-- USERS
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.users (
    id                  SERIAL          PRIMARY KEY,
    username            VARCHAR(100)    NOT NULL UNIQUE,
    email               VARCHAR(255)    NOT NULL UNIQUE,
    password_hash       VARCHAR(255)    NOT NULL,
    first_name          VARCHAR(100)    NOT NULL,
    last_name           VARCHAR(100)    NOT NULL,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    is_locked           BOOLEAN         NOT NULL DEFAULT FALSE,
    failed_login_count  INT             NOT NULL DEFAULT 0,
    last_login_at       TIMESTAMP,
    password_changed_at TIMESTAMP       NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------
-- USER ROLES
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.user_roles (
    id          SERIAL      PRIMARY KEY,
    user_id     INT         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id     INT         NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- -----------------------------------------------------------------------
-- USER APPLICATIONS (which apps a user can access)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.user_applications (
    id              SERIAL      PRIMARY KEY,
    user_id         INT         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id  INT         NOT NULL REFERENCES auth.applications(id) ON DELETE CASCADE,
    granted_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    granted_by      INT         REFERENCES auth.users(id),
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    UNIQUE(user_id, application_id)
);

-- -----------------------------------------------------------------------
-- SSO CODES (Authorization Codes - one-time, 60s expiry)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.sso_codes (
    id              SERIAL          PRIMARY KEY,
    code            VARCHAR(128)    NOT NULL UNIQUE,
    user_id         INT             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id  INT             NOT NULL REFERENCES auth.applications(id) ON DELETE CASCADE,
    redirect_uri    VARCHAR(2000)   NOT NULL,
    scope           VARCHAR(500)    NOT NULL DEFAULT 'openid profile email',
    code_challenge  VARCHAR(256),               -- PKCE support
    code_challenge_method VARCHAR(10),
    is_used         BOOLEAN         NOT NULL DEFAULT FALSE,
    expires_at      TIMESTAMP       NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------
-- REFRESH TOKENS
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id              SERIAL          PRIMARY KEY,
    token_hash      VARCHAR(255)    NOT NULL UNIQUE,   -- SHA256 of raw token
    user_id         INT             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id  INT             NOT NULL REFERENCES auth.applications(id) ON DELETE CASCADE,
    scope           VARCHAR(500)    NOT NULL,
    is_revoked      BOOLEAN         NOT NULL DEFAULT FALSE,
    family_id       VARCHAR(128),                      -- rotation family for reuse detection
    expires_at      TIMESTAMP       NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMP
);

-- -----------------------------------------------------------------------
-- AUDIT LOG
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.audit_log (
    id          SERIAL          PRIMARY KEY,
    user_id     INT             REFERENCES auth.users(id),
    event_type  VARCHAR(100)    NOT NULL,
    app_key     VARCHAR(100),
    ip_address  VARCHAR(45),
    user_agent  VARCHAR(500),
    details     TEXT,
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sso_codes_code        ON auth.sso_codes(code);
CREATE INDEX IF NOT EXISTS idx_sso_codes_expires      ON auth.sso_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash    ON auth.refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON auth.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family  ON auth.refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_users_username         ON auth.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email            ON auth.users(email);
CREATE INDEX IF NOT EXISTS idx_audit_log_user         ON auth.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event        ON auth.audit_log(event_type, created_at);

-- -----------------------------------------------------------------------
-- SEED DEFAULT ROLES
-- -----------------------------------------------------------------------
INSERT INTO auth.roles (role_name, description) VALUES
    ('super_admin',     'Full system access'),
    ('admin',           'Administrative access'),
    ('manager',         'Manager level access'),
    ('user',            'Standard user access'),
    ('readonly',        'Read-only access')
ON CONFLICT (role_name) DO NOTHING;

-- -----------------------------------------------------------------------
-- SEED DEFAULT APPLICATIONS
-- password: 'changeme_in_prod' - store only the hash in production
-- client_secret below is a placeholder; generate with: openssl rand -hex 32
-- -----------------------------------------------------------------------
INSERT INTO auth.applications (app_key, app_name, client_id, client_secret_hash, redirect_uris, allowed_scopes) VALUES
    ('pms',      'Property Management System', 'pms-client-id',
     '$2b$12$PLACEHOLDER_HASH_PMS',
     '["https://pms.yourdomain.com/auth/callback"]',
     'openid profile email roles apps'),
    ('salespro', 'SalesPro CRM', 'salespro-client-id',
     '$2b$12$PLACEHOLDER_HASH_SALES',
     '["https://salespro.yourdomain.com/auth/callback"]',
     'openid profile email roles apps'),
    ('cafm',     'Computer-Aided Facility Management', 'cafm-client-id',
     '$2b$12$PLACEHOLDER_HASH_CAFM',
     '["https://cafm.yourdomain.com/auth/callback"]',
     'openid profile email roles apps'),
    ('hrms',     'Human Resource Management System', 'hrms-client-id',
     '$2b$12$PLACEHOLDER_HASH_HRMS',
     '["https://hrms.yourdomain.com/auth/callback"]',
     'openid profile email roles apps')
ON CONFLICT (app_key) DO NOTHING;

COMMIT;