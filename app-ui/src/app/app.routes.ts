import { Routes } from "@angular/router";
import { LoginComponent } from "./auth/components/login/login.component";
import { CallbackComponent } from "./auth/components/callback/callback.component";
import { DashboardComponent } from "./auth/components/dashboard/dashboard.component";
import { UserListComponent } from "./auth/components/users/user-list.component";
import { UserFormComponent } from "./auth/components/users/user-form.component";
import { authGuard, noAuthGuard, roleGuard } from "./auth/guards/auth.guard";

export const routes: Routes = [
  { path: "login", component: LoginComponent, canActivate: [noAuthGuard] },
  { path: "auth/callback", component: CallbackComponent },
  { path: "dashboard", component: DashboardComponent, canActivate: [authGuard] },
  {
    path: "admin",
    canActivate: [authGuard, roleGuard("Admin")],
    children: [
      { path: "users", component: UserListComponent },
      { path: "users/new", component: UserFormComponent },
      { path: "users/:userId", component: UserFormComponent },
      { path: "", redirectTo: "users", pathMatch: "full" },
    ],
  },
  { path: "", redirectTo: "dashboard", pathMatch: "full" },
  { path: "**", redirectTo: "login" },
];
