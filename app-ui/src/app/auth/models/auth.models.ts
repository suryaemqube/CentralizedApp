// src/app/auth/models/auth.models.ts

export interface JwtPayload {
    sub:       string;
    username:  string;
    email:     string;
    firstName: string;
    lastName:  string;
    role:      string;
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

export interface AuthState {
    isAuthenticated: boolean;
    accessToken:     string | null;
    user:            JwtPayload | null;
    expiresAt:       number | null;
}

export interface ParameterItem {
    id:    number;
    value: string;
    order: number;
}

export interface AppItem {
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

export interface UserFormData {
    userId?:      number;
    employeeCode: string;
    departmentId: number | null;
    firstName:    string;
    lastName:     string;
    username:     string;
    email:        string;
    password:     string;
    retypePassword: string;
    startDate:    string;
    endDate:      string;
    roleId:       number | null;
    statusId:     number | null;
    appIds:       number[];
}
