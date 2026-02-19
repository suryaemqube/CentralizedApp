// src/models/entities/index.ts

// ── Database row shapes ──────────────────────────────────────────────────────

export interface UserLoginRow {
    out_userid:       string;  // pg returns bigint as string
    out_username:     string;
    out_email:        string;
    out_firstname:    string;
    out_lastname:     string;
    out_passwordhash: string;
    out_isactive:     boolean;
    out_islocked:     boolean;
    out_statusvalue:  string;  // 'Draft' | 'Active' | 'Inactive'
    out_rolename:     string;
    out_appids:       string;  // JSON array string e.g. "[1,2,3]"
    out_appnames:     string;  // JSON array string e.g. '["PMS","HRMS"]'
}

export interface UserRow {
    out_ssonid:      string;
    out_empcode:     string;
    out_firstname:   string;
    out_lastname:    string;
    out_department:  string;
    out_apps:        string;
    out_statusvalue: string;
    out_email:       string;
    out_rolename:    string;
    out_startdate:   string;
    out_enddate:     string | null;
}

export interface ParameterDetRow {
    out_detid: string;
    out_value: string;
    out_order: string;
}

export interface ApplicationRow {
    out_appid:    string;
    out_appname:  string;
    out_appurl:   string;
    out_iconpath: string;
    out_clientid: string;
    out_isactive: boolean;
}

export interface ValidateSsoCodeRow {
    out_valid:           boolean;
    out_userid:          string;
    out_appid:           string;
    out_scope:           string;
    out_codechallenge:   string;
    out_challengemethod: string;
    out_message:         string;
}

export interface ValidateRefreshTokenRow {
    out_valid:   boolean;
    out_userid:  string;
    out_appid:   string;
    out_scope:   string;
    out_message: string;
}

// ── DTOs / API shapes ────────────────────────────────────────────────────────

export interface JwtPayload {
    sub:       string;    // UserId as string
    username:  string;
    email:     string;
    firstName: string;
    lastName:  string;
    role:      string;    // single role
    appIds:    number[];
    appNames:  string[];
    client_id: string;
    scope:     string;
    iat:       number;
    exp:       number;
    jti:       string;
}

export interface TokenResponse {
    access_token: string;
    token_type:   'Bearer';
    expires_in:   number;
    scope:        string;
}

export interface ParameterItem {
    id:    number;
    value: string;
    order: number;
}

export interface ApplicationItem {
    appId:    number;
    appName:  string;
    appUrl:   string;
    iconPath: string;
    clientId: string;
}

export interface UserListItem {
    ssonId:     number;
    empCode:    string;
    firstName:  string;
    lastName:   string;
    department: string;
    apps:       string;
    status:     string;
    email:      string;
    role:       string;
    startDate:  string;
    endDate:    string | null;
}

export interface CreateUserDto {
    employeeCode: string;
    departmentId: number;
    firstName:    string;
    lastName:     string;
    username:     string;
    email:        string;
    password:     string;
    startDate:    string;
    endDate?:     string;
    roleId:       number;
    statusId:     number;
    appIds:       number[];
}

export interface UpdateUserDto {
    userId:       number;
    employeeCode: string;
    departmentId: number;
    firstName:    string;
    lastName:     string;
    username:     string;
    email:        string;
    startDate:    string;
    endDate?:     string;
    roleId:       number;
    statusId:     number;
    appIds:       number[];
}
