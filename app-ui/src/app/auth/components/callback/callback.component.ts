import { Component, OnInit } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { ActivatedRoute }    from '@angular/router';
import { AuthService }       from '../../services/auth.service';

@Component({
    selector:   'app-callback',
    templateUrl: './callback.component.html',
    styleUrls: ['./callback.component.css'],
    imports:    [CommonModule],
   
})
export class CallbackComponent implements OnInit {
    loading  = true;
    errorMsg: string | null = null;

    constructor(private route: ActivatedRoute, private auth: AuthService) {}

    ngOnInit(): void {
        const q = this.route.snapshot.queryParams as Record<string, string>;
        const code  = q['code'];
        const state = q['state'];
        const err   = q['error'];

        if (err) { this.loading = false; this.errorMsg = q['error_description'] || err; return; }
        if (!code || !state) { this.loading = false; this.errorMsg = 'Missing code or state.'; return; }

        this.auth.handleCallback(code, state).subscribe({
            error: (e: Error) => { this.loading = false; this.errorMsg = e.message || 'Authentication failed.'; }
        });
    }

    retry(): void { void this.auth.initiateLogin(); }
}
