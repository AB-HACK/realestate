import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useThemeStore } from "@/stores/theme-store";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { ToastContainer } from "@/components/ui/toast";
import LoginPage from "@/pages/auth/login";
import SignupPage from "@/pages/auth/signup";
import ForgotPasswordPage from "@/pages/auth/forgot-password";

const OnboardingPage = lazy(() => import("@/pages/onboarding/onboarding"));
const DashboardPage = lazy(() => import("@/pages/dashboard/dashboard"));
const PropertiesPage = lazy(() => import("@/pages/properties/properties"));
const PropertyDetailPage = lazy(() => import("@/pages/properties/property-detail"));
const PropertyFormPage = lazy(() => import("@/pages/properties/property-form"));
const ClientsPage = lazy(() => import("@/pages/clients/clients"));
const ClientDetailPage = lazy(() => import("@/pages/clients/client-detail"));
const ClientFormPage = lazy(() => import("@/pages/clients/client-form"));
const AppointmentsPage = lazy(() => import("@/pages/appointments/appointments"));
const DocumentsPage = lazy(() => import("@/pages/documents/documents"));
const SettingsPage = lazy(() => import("@/pages/settings/settings"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}

export default function App() {
  const theme = useThemeStore((s) => s.theme);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
        <Route path="/signup" element={isAuthenticated ? <Navigate to="/dashboard" /> : <SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          {!hasCompletedOnboarding && (
            <Route path="/onboarding" element={<Suspense fallback={<PageLoader />}><OnboardingPage /></Suspense>} />
          )}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
            <Route path="/properties" element={<Suspense fallback={<PageLoader />}><PropertiesPage /></Suspense>} />
            <Route path="/properties/new" element={<Suspense fallback={<PageLoader />}><PropertyFormPage /></Suspense>} />
            <Route path="/properties/:id" element={<Suspense fallback={<PageLoader />}><PropertyDetailPage /></Suspense>} />
            <Route path="/properties/:id/edit" element={<Suspense fallback={<PageLoader />}><PropertyFormPage /></Suspense>} />
            <Route path="/clients" element={<Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>} />
            <Route path="/clients/new" element={<Suspense fallback={<PageLoader />}><ClientFormPage /></Suspense>} />
            <Route path="/clients/:id" element={<Suspense fallback={<PageLoader />}><ClientDetailPage /></Suspense>} />
            <Route path="/clients/:id/edit" element={<Suspense fallback={<PageLoader />}><ClientFormPage /></Suspense>} />
            <Route path="/appointments" element={<Suspense fallback={<PageLoader />}><AppointmentsPage /></Suspense>} />
            <Route path="/documents" element={<Suspense fallback={<PageLoader />}><DocumentsPage /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFoundPage /></Suspense>} />
      </Routes>
      <ToastContainer />
    </>
  );
}
