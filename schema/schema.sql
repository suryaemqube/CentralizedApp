
CREATE TABLE Parameter (
    ParameterId   BIGSERIAL PRIMARY KEY,
	ParameterText   VARCHAR(100)
);

CREATE TABLE ParameterDet (
    ParameterDetId   BIGSERIAL PRIMARY KEY,
    ParameterId   INT NOT NULL REFERENCES Parameter(ParameterId),
	ParameterNo   INT NOT NULL,
	ParameterValues    VARCHAR(100),
	DisplayOrder   INT NOT NULL
);


CREATE TABLE Applications (
    AppId     BIGSERIAL PRIMARY KEY,
    AppName   VARCHAR(100) NOT NULL,
    AppURL   VARCHAR(250),
	ClientId     VARCHAR(200)    NOT NULL UNIQUE,
    ClientSecretHash  VARCHAR(255)    NOT NULL,
    Description  TEXT
	IsActive   BOOLEAN    NOT NULL DEFAULT TRUE,
);


CREATE TABLE Users (
    UserId     BIGSERIAL  PRIMARY KEY,
    EmployeeCode    VARCHAR(50)  NOT NULL UNIQUE,
    DepartmentId    INT NOT NULL  REFERENCES ParameterDet(ParameterDetId),
    FirstName  	VARCHAR(100) NOT NULL,
    LastName  	VARCHAR(100) NOT NULL,
    Username    VARCHAR(100) NOT NULL UNIQUE,
    Email     VARCHAR(100) NOT NULL UNIQUE,
    Password   VARCHAR(300) NOT NULL,
    StartDate  	DATE  NOT NULL,
    EndDate   	DATE,
	RoleId      Int   NOT NULL REFERENCES Roles(RoleId),
    Status     SMALLINT NOT NULL REFERENCES ParameterDet(ParameterDetId),
    CreatedAt  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UpdatedAt  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE UserApplications (
    UserAppId  BIGSERIAL  PRIMARY KEY,
    UserId    BIGINT  NOT NULL REFERENCES Users(UserId) ON DELETE CASCADE,
    AppId    BIGSERIAL NOT NULL REFERENCES Applications(AppId) ON DELETE CASCADE,
	IsActive   BOOLEAN     NOT NULL DEFAULT TRUE,
    UNIQUE (UserId, AppId)
);


CREATE TABLE RefreshTokens (
    Id  BIGSERIAL  PRIMARY KEY,
    UserId  BIGINT NOT NULL REFERENCES Users(UserId) ON DELETE CASCADE,
	AppId  INT      NOT NULL REFERENCES Applications(AppId) ON DELETE CASCADE,
    TokenHash  VARCHAR(260) NOT NULL UNIQUE,
    ExpiresAt TIMESTAMPTZ  NOT NULL,
    CreatedAt  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    RevokedAt  TIMESTAMPTZ,
    IpAddress  VARCHAR(50),
    UserAgent TEXT
);

CREATE TABLE Roles (
    RoleId    SERIAL PRIMARY KEY,
    RoleName   VARCHAR(50) UNIQUE
);

CREATE TABLE SSOCodes (
    Id      SERIAL          PRIMARY KEY,
    Code  VARCHAR(128)    NOT NULL UNIQUE,
    UserId  BIGINT             NOT NULL REFERENCES Users(UserId) ON DELETE CASCADE,
    AppId  INT             NOT NULL REFERENCES Applications(AppId) ON DELETE CASCADE,
    Scope        VARCHAR(500)    NOT NULL DEFAULT 'openid profile email',
    CodeChallenge  VARCHAR(256),  
    CodeChallengeMethod VARCHAR(10),
    IsUsed     BOOLEAN    NOT NULL DEFAULT FALSE,
    ExpiresAt   TIMESTAMPTZ  NOT NULL,
    CreatedAt  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE PasswordResetCodes (
    Id         SERIAL PRIMARY KEY,
    UserId     BIGINT NOT NULL REFERENCES Users(UserId) ON DELETE CASCADE,
    CodeHash   VARCHAR(300) NOT NULL,
    ExpiresAt  TIMESTAMPTZ NOT NULL,
    CreatedAt  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (UserId)
);

CREATE TABLE AuditLog (
    Id          SERIAL          PRIMARY KEY,
    UserId     BIGINT     REFERENCES Users(UserId),
    EventType  VARCHAR(100)    NOT NULL,
    AppKey     VARCHAR(100),
    IpAddress  VARCHAR(45),
    UserAgent  VARCHAR(500),
    Details     TEXT,
    CreatedAt  TIMESTAMP       NOT NULL DEFAULT NOW()
);

INSERT INTO Roles(RoleName) VALUES ('Admin'), ('Executive');

INSERT INTO Parameter(ParameterText) VALUES ('Department'), ('Status');

INSERT INTO ParameterDet(ParameterId, ParameterNo, ParameterValues, DisplayOrder)
SELECT p.ParameterId, 1, 'Management', 1 FROM Parameter p WHERE p.ParameterText = 'Department';
INSERT INTO ParameterDet(ParameterId, ParameterNo, ParameterValues, DisplayOrder)
SELECT p.ParameterId, 2, 'IT', 2 FROM Parameter p WHERE p.ParameterText = 'Department';
INSERT INTO ParameterDet(ParameterId, ParameterNo, ParameterValues, DisplayOrder)
SELECT p.ParameterId, 3, 'HR', 3 FROM Parameter p WHERE p.ParameterText = 'Department';
INSERT INTO ParameterDet(ParameterId, ParameterNo, ParameterValues, DisplayOrder)
SELECT p.ParameterId, 4, 'Finance', 4 FROM Parameter p WHERE p.ParameterText = 'Department';




INSERT INTO ParameterDet(ParameterId, ParameterNo, ParameterValues, DisplayOrder)
SELECT p.ParameterId, 1, 'Active', 1 FROM Parameter p WHERE p.ParameterText = 'Status';
INSERT INTO ParameterDet(ParameterId, ParameterNo, ParameterValues, DisplayOrder)
SELECT p.ParameterId, 2, 'Draft', 2 FROM Parameter p WHERE p.ParameterText = 'Status';
INSERT INTO ParameterDet(ParameterId, ParameterNo, ParameterValues, DisplayOrder)
SELECT p.ParameterId, 3, 'Inactive', 3 FROM Parameter p WHERE p.ParameterText = 'Status';


INSERT INTO Users (
  EmployeeCode, DepartmentId, FirstName, LastName, Username, Email, Password,
  StartDate, RoleId, Status, IsSent
)
SELECT
  'cent_admin',
  (SELECT ParameterDetId FROM ParameterDet pd JOIN Parameter p ON p.ParameterId = pd.ParameterId WHERE p.ParameterText = 'Department' AND pd.ParameterValues = 'Management' LIMIT 1),
  'Mohammed', 'Sutarwala', 'admin', 'mohammed@emqube.com',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uHwHyWutO',
  CURRENT_DATE,
  (SELECT RoleId FROM Roles WHERE RoleName = 'Admin'),
  (SELECT ParameterDetId FROM ParameterDet pd JOIN Parameter p ON p.ParameterId = pd.ParameterId WHERE p.ParameterText = 'Status' AND pd.ParameterValues = 'Active' LIMIT 1),
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'admin');


INSERT INTO Users (
  EmployeeCode, DepartmentId, FirstName, LastName, Username, Email, Password,
  StartDate, RoleId, Status, IsSent
)
SELECT
  'swan0020',
  (SELECT ParameterDetId FROM ParameterDet pd JOIN Parameter p ON p.ParameterId = pd.ParameterId WHERE p.ParameterText = 'Department' AND pd.ParameterValues = 'IT' LIMIT 1),
  'jumana', 'Rajkotwala', 'swan0020', 'jumana@swansol.com',
  '$2a$12$CqZNtPsT8zNfh1X5A5p5S.5Q5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5',
  CURRENT_DATE,
  (SELECT RoleId FROM Roles WHERE RoleName = 'Executive'),
  (SELECT ParameterDetId FROM ParameterDet pd JOIN Parameter p ON p.ParameterId = pd.ParameterId WHERE p.ParameterText = 'Status' AND pd.ParameterValues = 'Active' LIMIT 1),
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'executive');


INSERT INTO Applications (AppName, AppURL, ClientId, ClientSecretHash, Description)
VALUES 
  ('SalesPro', 'http://localhost:5002', 'salespro', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewTa0NeE.JxBSc3S', 'Sales CRM')
ON CONFLICT DO NOTHING;


INSERT INTO UserApplications (UserId, AppId)
SELECT u.UserId, a.AppId
FROM Users u, Applications a
WHERE u.Username = 'admin'
ON CONFLICT DO NOTHING;


INSERT INTO UserApplications (UserId, AppId)
SELECT u.UserId, a.AppId
FROM Users u, Applications a
WHERE u.Username = 'executive' AND a.AppName IN ('SalesPro')
ON CONFLICT DO NOTHING;