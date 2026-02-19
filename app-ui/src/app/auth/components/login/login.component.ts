// src/app/auth/components/login/login.component.ts
import { Component, OnInit }     from '@angular/core';
import { CommonModule }          from '@angular/common';
import { FormsModule }           from '@angular/forms';
import { HttpClient }            from '@angular/common/http';
import { ActivatedRoute }        from '@angular/router';
import { environment }           from '../../../../environments/environment';

@Component({
    selector:   'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    imports:    [CommonModule, FormsModule],
   
})
export class LoginComponent implements OnInit {
    username  = '';
    password  = '';
    state     = '';
    clientId  = '';
    loading   = false;
    errorMsg: string | null = null;

    constructor(private http: HttpClient, private route: ActivatedRoute) {}

    ngOnInit(): void {
        const q = this.route.snapshot.queryParams as Record<string, string>;
        this.state    = q['state']     || '';
        this.clientId = q['client_id'] || environment.clientId;
    }

    onSubmit(): void {
        if (!this.username || !this.password) { this.errorMsg = 'Please enter username and password.'; return; }
        this.loading  = true;
        this.errorMsg = null;

        this.http.post<{ redirect_url: string }>(
            `${environment.authServerUrl}/sso/login`,
            { username: this.username, password: this.password, state: this.state },
            { withCredentials: true }
        ).subscribe({
            next:  r   => { window.location.href = r.redirect_url; },
            error: err => {
                this.loading = false;
                this.password = '';
                const e = err as { error?: { error_description?: string } };
                this.errorMsg = e.error?.error_description || 'Invalid username or password.';
            },
        });
    }
}
