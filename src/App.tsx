import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/app-layout';
import { ProtectedRoute } from './components/auth/protected-route';
import { Login } from './pages/auth/login';
import { Register } from './pages/auth/register';
import { Dashboard } from './pages/dashboard/dashboard';
import { Properties } from './pages/properties/properties';
import { PropertyDetail } from './pages/properties/property-detail';
import { PropertyForm } from './pages/properties/property-form';
import { Buildings } from './pages/buildings/buildings';
import { BuildingForm } from './pages/buildings/building-form';
import { BuildingDetail } from './pages/buildings/building-detail';
import { Documents } from './pages/documents/documents';
import { InspectionsPage } from './pages/trust/inspections';
import { AgentVerificationPage } from './pages/trust/agent-verification';
import { AdminReview } from './pages/admin/admin-review';
import { AuditLog } from './pages/admin/audit-log';
import { Settings } from './pages/settings/settings';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Phase 1 Land & Plot Evidence Routes */}
          <Route path="/plots" element={<Properties />} />
          <Route path="/plots/new" element={<PropertyForm />} />
          <Route path="/plots/:id" element={<PropertyDetail />} />

          {/* Phase 2 Built Houses, Duplexes & Apartments Routes */}
          <Route path="/buildings" element={<Buildings />} />
          <Route path="/buildings/new" element={<BuildingForm />} />
          <Route path="/buildings/:id" element={<BuildingDetail />} />

          {/* Backwards-compatible aliases */}
          <Route path="/properties" element={<Navigate to="/plots" replace />} />
          <Route path="/properties/new" element={<Navigate to="/plots/new" replace />} />

          {/* Phase 3 Trust Layer Routes: Field Inspections (D1) & Agent Regulatory Check (D2) */}
          <Route path="/inspections" element={<InspectionsPage />} />
          <Route path="/agents" element={<AgentVerificationPage />} />

          {/* Private Document Vault & Proof-of-Payment Trail (D4) */}
          <Route path="/documents" element={<Documents />} />

          {/* Admin Spatial Conflict & Document Review + Tamper-Evident Audit Log */}
          <Route path="/admin/review" element={<AdminReview />} />
          <Route path="/admin/audit" element={<AuditLog />} />

          {/* NDPA 2023 & Dual Currency Settings */}
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
