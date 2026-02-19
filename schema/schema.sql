
CREATE TABLE Parameter (
    ParameterId   BIGSERIAL PRIMARY KEY,
	ParameterText   VARCHAR(100)
);

INSERT INTO Parameter(ParameterText) VALUES ('Department'), ('Status');


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
    description  TEXT
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

INSERT INTO Roles(RoleName) VALUES ('Admin'), ('Executive');


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

CREATE TABLE IF NOT EXISTS auth.audit_log (
    Id          SERIAL          PRIMARY KEY,
    UserId     BIGINT             REFERENCES Users(UserId),
    EventType  VARCHAR(100)    NOT NULL,
    appKey     VARCHAR(100),
    IpAddress  VARCHAR(45),
    UserAgent  VARCHAR(500),
    Details     TEXT,
    CreatedAt  TIMESTAMP       NOT NULL DEFAULT NOW()
);