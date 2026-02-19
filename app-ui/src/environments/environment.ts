export const environment = {
    production:         false,
    authServerUrl:      'http://localhost:3000',
    clientId:           'Central-client-id',        // change per app
    clientSecret:       'Central-Auth-Admin',   // use backend proxy in production
    scopes:             'openid profile email roles apps',
    tokenRefreshBuffer: 120,               
    appKey:             'central',
};