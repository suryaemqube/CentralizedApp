import { Component, OnInit } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { HttpClient }        from '@angular/common/http';
import { AuthService }       from '../../services/auth.service';
import { environment }       from '../../../../environments/environment';
import { AppItem }           from '../../models/auth.models';
import { JwtPayload } from '../../models/auth.models';

@Component({
    selector:   'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css'],
    imports:    [CommonModule],
   
})
export class DashboardComponent implements OnInit {
    user:JwtPayload | null = null;
    userApps:   AppItem[] = [];
    lockedApps: AppItem[] = [];
    allApps:    AppItem[] = [];

    constructor(private auth: AuthService, private http: HttpClient) {}

    ngOnInit(): void {
        this.user = this.auth.currentUser();
        this.loadApps();
    }

    loadApps(): void {
        this.http.get<{ data: AppItem[] }>(
            `${environment.authServerUrl}/api/applications`,
            { withCredentials: true }
        ).subscribe({
            next: res => {
                this.allApps   = res.data;
                const userAppIds = this.auth.currentUser()?.appIds ?? [];
                this.userApps   = res.data.filter(a => userAppIds.includes(a.appId));
                this.lockedApps = res.data.filter(a => !userAppIds.includes(a.appId));
            },
        });
    }

    openApp(app: AppItem): void {
        if (app.appUrl) window.open(app.appUrl, '_blank');
    }

    logout(): void { this.auth.logout(); }
}
