import { Routes } from '@angular/router';
import { authGuard, permissionGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login.component').then((m) => m.LoginComponent),
    title: 'STEG Back Office — Login',
  },
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./features/placeholder.component').then((m) => m.ForbiddenComponent),
    title: 'STEG Back Office — Restricted',
  },
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard()],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard.component').then((m) => m.DashboardComponent),
        title: 'STEG Back Office — Dashboard',
      },
      {
        path: 'applications',
        loadComponent: () =>
          import('./features/applications/application-queue.component').then(
            (m) => m.ApplicationsComponent,
          ),
        canActivate: [permissionGuard(['APPLICATION_VIEW'])],
        title: 'STEG Back Office — Applications',
      },
      {
        path: 'applications/new',
        loadComponent: () =>
          import('./features/applications/manual-intake.component').then(
            (m) => m.ManualIntakeComponent,
          ),
        canActivate: [permissionGuard(['APPLICATION_REVIEW'])],
        title: 'STEG Back Office — Manual intake',
      },
      {
        path: 'applications/:id',
        loadComponent: () =>
          import('./features/applications/application-dossier.component').then(
            (m) => m.ApplicationDossierComponent,
          ),
        canActivate: [permissionGuard(['APPLICATION_VIEW'])],
        title: 'STEG Back Office — Application dossier',
      },
      {
        path: 'candidates',
        loadComponent: () =>
          import('./features/candidates/candidate-list.component').then(
            (m) => m.CandidateListComponent,
          ),
        canActivate: [permissionGuard(['CANDIDATE_VIEW'])],
        title: 'STEG Back Office — Candidates',
      },
      {
        path: 'candidates/:id',
        loadComponent: () =>
          import('./features/candidates/candidate-detail.component').then(
            (m) => m.CandidateDetailComponent,
          ),
        canActivate: [permissionGuard(['CANDIDATE_VIEW'])],
        title: 'STEG Back Office — Candidate',
      },
      {
        path: 'internships',
        loadComponent: () =>
          import('./features/internships/internship-list.component').then(
            (m) => m.InternshipListComponent,
          ),
        canActivate: [permissionGuard(['INTERNSHIP_VIEW'])],
        title: 'STEG Back Office — Internships',
      },
      {
        path: 'internships/new',
        loadComponent: () =>
          import('./features/internships/internship-create.component').then(
            (m) => m.InternshipCreateComponent,
          ),
        canActivate: [permissionGuard(['INTERNSHIP_ASSIGN'])],
        title: 'STEG Back Office — New internship',
      },
      {
        path: 'internships/:id',
        loadComponent: () =>
          import('./features/internships/internship-detail.component').then(
            (m) => m.InternshipDetailComponent,
          ),
        canActivate: [permissionGuard(['INTERNSHIP_VIEW'])],
        title: 'STEG Back Office — Internship',
      },
      {
        path: 'supervisor',
        loadComponent: () =>
          import('./features/internships/supervisor-dashboard.component').then(
            (m) => m.SupervisorDashboardComponent,
          ),
        canActivate: [permissionGuard(['INTERNSHIP_VIEW'])],
        title: 'STEG Back Office — Supervision',
      },
      {
        path: 'supervisor-dashboard',
        loadComponent: () =>
          import('./features/internships/supervisor-home.component').then(
            (m) => m.SupervisorHomeComponent,
          ),
        canActivate: [permissionGuard(['INTERNSHIP_VIEW'])],
        title: 'STEG Back Office — Supervisor dashboard',
      },
      // E3: no standalone assignments/documents workspaces — assignment lives in the
      // internship-detail assignment tab, document review in the dossier/finance workspaces
      // (all E2-proven). Redundant placeholder routes removed, not stubbed.
      {
        path: 'finance',
        loadComponent: () =>
          import('./features/finance/finance-queue.component').then((m) => m.FinanceQueueComponent),
        canActivate: [permissionGuard(['FINANCE_CASE_VIEW'])],
        title: 'STEG Back Office — Finance',
      },
      {
        path: 'finance/:id',
        loadComponent: () =>
          import('./features/finance/finance-detail.component').then(
            (m) => m.FinanceDetailComponent,
          ),
        canActivate: [permissionGuard(['FINANCE_CASE_VIEW'])],
        title: 'STEG Back Office — Finance case',
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent),
        canActivate: [permissionGuard(['REPORT_VIEW'])],
        title: 'STEG Back Office — Reports',
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notification-center.component').then(
            (m) => m.NotificationCenterComponent,
          ),
        canActivate: [permissionGuard(['NOTIFICATION_MANAGE'])],
        title: 'STEG Back Office — Notifications',
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/tasks/task-list.component').then((m) => m.TaskListComponent),
        canActivate: [permissionGuard(['TASK_MANAGE'])],
        title: 'STEG Back Office — Tasks',
      },
      {
        path: 'tasks/drafts',
        loadComponent: () =>
          import('./features/tasks/draft-review.component').then((m) => m.DraftReviewComponent),
        canActivate: [permissionGuard(['TASK_MANAGE'])],
        title: 'STEG Back Office — AI task drafts',
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/admin/audit-viewer.component').then((m) => m.AuditViewerComponent),
        canActivate: [permissionGuard(['AUDIT_VIEW'])],
        title: 'STEG Back Office — Audit',
      },
      {
        path: 'supervisors',
        loadComponent: () =>
          import('./features/supervisors/supervisor-list.component').then(
            (m) => m.SupervisorListComponent,
          ),
        canActivate: [permissionGuard(['USER_MANAGE'])],
        title: 'STEG Back Office — Supervisors',
      },
      {
        path: 'intern-accounts',
        loadComponent: () =>
          import('./features/intern-accounts/intern-account-list.component').then(
            (m) => m.InternAccountListComponent,
          ),
        canActivate: [permissionGuard(['USER_MANAGE'])],
        title: 'STEG Back Office — Comptes STEG intern',
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./features/admin/admin-workspace.component').then(
            (m) => m.AdminWorkspaceComponent,
          ),
        canActivate: [permissionGuard(['USER_MANAGE'])],
        title: 'STEG Back Office — Administration',
      },
      {
        path: 'validation',
        loadComponent: () =>
          import('./features/validation/validation-list.component').then(
            (m) => m.ValidationListComponent,
          ),
        canActivate: [permissionGuard(['VALIDATION_MANAGE'])],
        title: 'STEG Back Office — Validation',
      },
      {
        path: 'validation/:id',
        loadComponent: () =>
          import('./features/validation/validation-detail.component').then(
            (m) => m.ValidationDetailComponent,
          ),
        canActivate: [permissionGuard(['VALIDATION_MANAGE'])],
        title: 'STEG Back Office — Validation detail',
      },
      {
        path: 'certificates',
        loadComponent: () =>
          import('./features/certificates/certificate-list.component').then(
            (m) => m.CertificateListComponent,
          ),
        canActivate: [permissionGuard(['CERTIFICATE_MANAGE'])],
        title: 'STEG Back Office — Certificates',
      },
      {
        path: 'certificates/:id',
        loadComponent: () =>
          import('./features/certificates/certificate-detail.component').then(
            (m) => m.CertificateDetailComponent,
          ),
        canActivate: [permissionGuard(['CERTIFICATE_MANAGE'])],
        title: 'STEG Back Office — Certificate detail',
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/placeholder.component').then((m) => m.NotFoundComponent),
    title: 'STEG Back Office — Not found',
  },
];
