// src/app/auth/components/users/user-form.component.ts
import { Component, OnInit }      from '@angular/core';
import { CommonModule }           from '@angular/common';
import { FormsModule }            from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient }             from '@angular/common/http';
import { environment }            from '../../../../environments/environment';
import { ParameterItem, AppItem, UserFormData } from '../../models/auth.models';

@Component({
    selector:   'app-user-form',
    imports:    [CommonModule, FormsModule],
    templateUrl: './user-form.component.html',
    styleUrls: ['./user-form.component.css'],
})
export class UserFormComponent implements OnInit {
    isEdit    = false;
    userId    = 0;
    saving    = false;
    errorMsg: string | null  = null;
    successMsg: string | null = null;
    showEmailNote  = false;
    emailSentBefore = false;

    form: UserFormData = {
        employeeCode: '', departmentId: null,
        firstName: '', lastName: '', username: '', email: '',
        password: '', retypePassword: '',
        startDate: '', endDate: '',
        roleId: null, statusId: null, appIds: [],
    };

    departments: ParameterItem[] = [];
    statuses:    ParameterItem[] = [];
    allApps:     AppItem[]       = [];

    get titleLabel(): string { return this.isEdit ? 'EDIT USER' : 'NAME OF PERSON'; }
    get selectedDeptName(): string {
        return this.departments.find(d => d.id === this.form.departmentId)?.value || 'DEPARTMENT';
    }

    constructor(
        private http:  HttpClient,
        private route: ActivatedRoute,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.loadLookups();
        const id = this.route.snapshot.params['userId'] as string;
        if (id && id !== 'new') {
            this.isEdit = true;
            this.userId = parseInt(id, 10);
            this.loadUser();
        } else {
            // Default to Draft status
            this.form.statusId = null;
        }
    }

    loadLookups(): void {
        this.http.get<{ data: ParameterItem[] }>(`${environment.authServerUrl}/api/parameters/Department`)
            .subscribe({ next: r => this.departments = r.data });
        this.http.get<{ data: ParameterItem[] }>(`${environment.authServerUrl}/api/parameters/Status`)
            .subscribe({ next: r => {
                this.statuses = r.data;
                if (!this.isEdit) {
                    const draft = r.data.find(s => s.value === 'Draft');
                    if (draft) this.form.statusId = draft.id;
                }
            }});
        this.http.get<{ data: AppItem[] }>(`${environment.authServerUrl}/api/applications`)
            .subscribe({ next: r => this.allApps = r.data });
    }

    loadUser(): void {
        // Load user details from list endpoint filtered by id
        // In production expose GET /api/users/:id endpoint
        this.http.get<{ data: { empCode: string; firstName: string; lastName: string;
            email: string; status: string; department: string; role: string;
            startDate: string; endDate: string | null; appIds: number[]; } }>(
            `${environment.authServerUrl}/api/users/${this.userId}`
        ).subscribe({
            next: r => {
                const u = r.data;
                const deptId   = this.departments.find(d => d.value === u.department)?.id ?? null;
                const statusId = this.statuses.find(s => s.value === u.status)?.id ?? null;
                this.form = {
                    ...this.form,
                    employeeCode: u.empCode,
                    departmentId: deptId,
                    firstName:    u.firstName,
                    lastName:     u.lastName,
                    email:        u.email,
                    statusId:     statusId,
                    startDate:    u.startDate ?? '',
                    endDate:      u.endDate ?? '',
                    appIds:       u.appIds ?? [],
                };
            },
        });
    }

    toggleApp(appId: number, event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        if (checked) {
            if (!this.form.appIds.includes(appId)) this.form.appIds = [...this.form.appIds, appId];
        } else {
            this.form.appIds = this.form.appIds.filter(id => id !== appId);
        }
    }

    onDeptChange(): void { /* header updates via getter */ }

    onSubmit(): void {
        this.errorMsg  = null;
        this.successMsg = null;

        if (!this.validate()) return;

        this.saving = true;
        const prevStatus = this.statuses.find(s => s.id === this.form.statusId)?.value || '';

        const payload = {
            employeeCode: this.form.employeeCode,
            departmentId: this.form.departmentId!,
            firstName:    this.form.firstName,
            lastName:     this.form.lastName,
            username:     this.form.username,
            email:        this.form.email,
            password:     this.form.password,
            startDate:    this.form.startDate,
            endDate:      this.form.endDate || undefined,
            roleId:       this.form.roleId  || 2,   // default Executive
            statusId:     this.form.statusId!,
            appIds:       this.form.appIds,
        };

        const request = this.isEdit
            ? this.http.put<{ success: boolean; message: string }>(
                `${environment.authServerUrl}/api/users/${this.userId}`, payload)
            : this.http.post<{ success: boolean; message: string; userId: number }>(
                `${environment.authServerUrl}/api/users`, payload);

        request.subscribe({
            next: r => {
                this.saving = false;
                this.successMsg = r.message;
                if (prevStatus !== 'Active' && this.statuses.find(s => s.id === this.form.statusId)?.value === 'Active') {
                    this.showEmailNote = true;
                    setTimeout(() => this.showEmailNote = false, 5000);
                }
                setTimeout(() => void this.router.navigate(['/admin/users']), 1500);
            },
            error: err => {
                this.saving = false;
                const e = err as { error?: { error_description?: string } };
                this.errorMsg = e.error?.error_description || 'An error occurred. Please try again.';
            },
        });
    }

    private validate(): boolean {
        if (!this.form.employeeCode) { this.errorMsg = 'Employee Code is required'; return false; }
        if (!this.form.departmentId) { this.errorMsg = 'Department is required'; return false; }
        if (!this.form.firstName)    { this.errorMsg = 'First Name is required'; return false; }
        if (!this.form.lastName)     { this.errorMsg = 'Last Name is required'; return false; }
        if (!this.form.username)     { this.errorMsg = 'Username is required'; return false; }
        if (!this.form.email)        { this.errorMsg = 'Email is required'; return false; }
        if (!this.form.startDate)    { this.errorMsg = 'Start Date is required'; return false; }
        if (!this.form.statusId)     { this.errorMsg = 'Status is required'; return false; }
        if (!this.isEdit) {
            if (!this.form.password)          { this.errorMsg = 'Password is required'; return false; }
            if (this.form.password.length < 8){ this.errorMsg = 'Password must be at least 8 characters'; return false; }
            if (this.form.password !== this.form.retypePassword) {
                this.errorMsg = 'Passwords do not match'; return false;
            }
        }
        return true;
    }
}
