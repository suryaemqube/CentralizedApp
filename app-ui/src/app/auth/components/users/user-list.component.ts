// src/app/auth/components/users/user-list.component.ts
import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../../environments/environment";
import { UserListItem, ParameterItem } from "../../models/auth.models";

@Component({
  selector: "app-user-list",
  imports: [CommonModule, FormsModule],
  templateUrl: "./user-list.component.html",
  styleUrls: ["./user-list.component.css"],
})
export class UserListComponent implements OnInit {
  statuses = ["Active", "Draft", "Inactive"];
  activeStatus = "Active";
  selectedDept = "";
  searchTerm = "";
  users: UserListItem[] = [];
  departments: ParameterItem[] = [];
  loading = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadDepartments();
    this.load();
  }

  loadDepartments(): void {
    this.http
      .get<{
        data: ParameterItem[];
      }>(`${environment.authServerUrl}/api/parameters/Department`)
      .subscribe({ next: (r) => (this.departments = r.data) });
  }

  load(): void {
    this.loading = true;
    const params: Record<string, string> = { status: this.activeStatus };
    if (this.selectedDept) params["departmentId"] = this.selectedDept;
    if (this.searchTerm) params["search"] = this.searchTerm;

    this.http
      .get<{
        data: UserListItem[];
      }>(`${environment.authServerUrl}/api/users`, { params })
      .subscribe({
        next: (r) => {
          this.users = r.data;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  setStatus(s: string): void {
    this.activeStatus = s;
    this.load();
  }

  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 350);
  }

  addNew(): void {
    void this.router.navigate(["/admin/users/new"]);
  }
  edit(u: UserListItem): void {
    void this.router.navigate(["/admin/users", u.ssonId]);
  }
}
