CREATE TABLE Parameter (
    ParameterId   BIGSERIAL    PRIMARY KEY,
    ParameterText VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE  ParameterDet (
    ParameterDetId BIGSERIAL    PRIMARY KEY,
    ParameterId    BIGINT       NOT NULL REFERENCES Parameter(ParameterId),
    ParameterNo    INT          NOT NULL,
    ParameterValues VARCHAR(100),
    DisplayOrder   INT          NOT NULL,
    UNIQUE (ParameterId, ParameterNo)
);


CREATE TABLE Roles (
    RoleId   SERIAL       PRIMARY KEY,
    RoleName VARCHAR(50)  NOT NULL UNIQUE
);

CREATE TABLE Applications (
    AppId            BIGSERIAL    PRIMARY KEY,
    AppName          VARCHAR(100) NOT NULL,
    AppURL           VARCHAR(250),
    IconPath         VARCHAR(250),
    ClientId         VARCHAR(200) NOT NULL UNIQUE,
    ClientSecretHash VARCHAR(255) NOT NULL,
    Description      TEXT,
    IsActive         BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE Users (
    UserId         BIGSERIAL    PRIMARY KEY,
    EmployeeCode   VARCHAR(50)  NOT NULL UNIQUE,
    DepartmentId   BIGINT       NOT NULL REFERENCES ParameterDet(ParameterDetId),
    FirstName      VARCHAR(100) NOT NULL,
    LastName       VARCHAR(100) NOT NULL,
    Username       VARCHAR(100) NOT NULL UNIQUE,
    Email          VARCHAR(100) NOT NULL UNIQUE,
    Password       VARCHAR(300) NOT NULL,
    StartDate      DATE         NOT NULL,
    EndDate        DATE,
    RoleId         INT          NOT NULL REFERENCES Roles(RoleId),
    Status         BIGINT       NOT NULL REFERENCES ParameterDet(ParameterDetId),
    IsSent         BOOLEAN      NOT NULL DEFAULT FALSE,
    CreatedAt      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UpdatedAt      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS UserApplications (
    UserAppId BIGSERIAL PRIMARY KEY,
    UserId    BIGINT    NOT NULL REFERENCES Users(UserId)        ON DELETE CASCADE,
    AppId     BIGINT    NOT NULL REFERENCES Applications(AppId)  ON DELETE CASCADE,
    IsActive  BOOLEAN   NOT NULL DEFAULT TRUE,
    UNIQUE (UserId, AppId)
);

CREATE TABLE IF NOT EXISTS SSOCodes (
    Id                  SERIAL       PRIMARY KEY,
    Code                VARCHAR(128) NOT NULL UNIQUE,
    UserId              BIGINT       NOT NULL REFERENCES Users(UserId)       ON DELETE CASCADE,
    AppId               INT          NOT NULL REFERENCES Applications(AppId) ON DELETE CASCADE,
    Scope               VARCHAR(500) NOT NULL DEFAULT 'openid profile email',
    CodeChallenge       VARCHAR(256),
    CodeChallengeMethod VARCHAR(10),
    IsUsed              BOOLEAN      NOT NULL DEFAULT FALSE,
    ExpiresAt           TIMESTAMPTZ  NOT NULL,
    CreatedAt           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS RefreshTokens (
    Id        BIGSERIAL    PRIMARY KEY,
    UserId    BIGINT       NOT NULL REFERENCES Users(UserId)       ON DELETE CASCADE,
    AppId     BIGINT       NOT NULL REFERENCES Applications(AppId) ON DELETE CASCADE,
    TokenHash VARCHAR(260) NOT NULL UNIQUE,
    ExpiresAt TIMESTAMPTZ  NOT NULL,
    CreatedAt TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    RevokedAt TIMESTAMPTZ,   
    IpAddress VARCHAR(50),
    UserAgent TEXT
);

CREATE TABLE IF NOT EXISTS AuditLog (
    Id        SERIAL       PRIMARY KEY,
    UserId    BIGINT       REFERENCES Users(UserId),
    EventType VARCHAR(100) NOT NULL,
    AppId     BIGINT       REFERENCES Applications(AppId),
    IpAddress VARCHAR(45),
    UserAgent VARCHAR(500),
    Details   TEXT,
    CreatedAt TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ssocodes_code       ON SSOCodes(Code);
CREATE INDEX IF NOT EXISTS idx_ssocodes_expires    ON SSOCodes(ExpiresAt);
CREATE INDEX IF NOT EXISTS idx_refreshtokens_hash  ON RefreshTokens(TokenHash);
CREATE INDEX IF NOT EXISTS idx_refreshtokens_user  ON RefreshTokens(UserId, AppId);
CREATE INDEX IF NOT EXISTS idx_users_username      ON Users(Username);
CREATE INDEX IF NOT EXISTS idx_users_email         ON Users(Email);
CREATE INDEX IF NOT EXISTS idx_users_status        ON Users(Status);
CREATE INDEX IF NOT EXISTS idx_users_dept          ON Users(DepartmentId);
CREATE INDEX IF NOT EXISTS idx_auditlog_user       ON AuditLog(UserId, CreatedAt);
CREATE INDEX IF NOT EXISTS idx_userapps_user       ON UserApplications(UserId);




INSERT INTO Roles (RoleName) VALUES ('Admin'), ('Executive')
ON CONFLICT (RoleName) DO NOTHING;


INSERT INTO Parameter (ParameterText) VALUES ('Department'), ('Status')
ON CONFLICT (ParameterText) DO NOTHING;

INSERT INTO ParameterDet (ParameterId, ParameterNo, ParameterValues, DisplayOrder)
SELECT p.ParameterId, v.pno, v.pval, v.dord
FROM Parameter p
CROSS JOIN (VALUES (1,'Draft',1),(2,'Active',2),(3,'Inactive',3)) AS v(pno,pval,dord)
WHERE p.ParameterText = 'Status'
ON CONFLICT (ParameterId, ParameterNo) DO NOTHING;


INSERT INTO ParameterDet (ParameterId, ParameterNo, ParameterValues, DisplayOrder)
SELECT p.ParameterId, v.pno, v.pval, v.dord
FROM Parameter p
CROSS JOIN (VALUES
    (1,'Management',1),(2,'Finance',2),(3,'IT',3),
    (4,'HR',4),(5,'Operations',5),(6,'Sales',6)
) AS v(pno,pval,dord)
WHERE p.ParameterText = 'Department'
ON CONFLICT (ParameterId, ParameterNo) DO NOTHING;

INSERT INTO Applications (AppName, AppURL, IconPath, ClientId, ClientSecretHash, Description, IsActive)
VALUES
  ('PMS',       'https://pms.yourdomain.com',      '/icons/pms.svg',      'pms-client-id',      '$2b$12$PLACEHOLDER_PMS',      'Property Management System',           TRUE),
  ('SalesPro',  'https://sales.yourdomain.com',    '/icons/sales.svg',    'salespro-client-id', '$2b$12$PLACEHOLDER_SALES',    'Sales & CRM Application',              TRUE),
  ('CAFM Pro',  'https://cafm.yourdomain.com',     '/icons/cafm.svg',     'cafm-client-id',     '$2b$12$PLACEHOLDER_CAFM',     'Computer-Aided Facility Management',   TRUE),
  ('1-3-5',     'https://135.yourdomain.com',      '/icons/135.svg',      '135-client-id',      '$2b$12$PLACEHOLDER_135',      '1-3-5 Goal Tracking Application',      TRUE),
  ('HRMS',      'https://hrms.yourdomain.com',     '/icons/hrms.svg',     'hrms-client-id',     '$2b$12$PLACEHOLDER_HRMS',     'Human Resource Management System',     TRUE)
ON CONFLICT (ClientId) DO NOTHING;