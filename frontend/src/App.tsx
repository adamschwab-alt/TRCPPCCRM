import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { SettingsProvider, useSettings } from "./settings";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvite from "./pages/AcceptInvite";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import Today from "./pages/Today";
import Pipeline from "./pages/Pipeline";
import OpportunityDetail from "./pages/OpportunityDetail";
import BidAnalytics from "./pages/BidAnalytics";
import EstimatorWorkload from "./pages/EstimatorWorkload";
import Customers from "./pages/Customers";
import Contacts from "./pages/Contacts";
import Compliance from "./pages/Compliance";
import Backlog from "./pages/Backlog";
import AdminSettings from "./pages/AdminSettings";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePwd) return <Navigate to="/change-password" replace />;
  return <Layout>{children}</Layout>;
}

function ModuleGate({
  mod,
  children,
}: {
  mod: string;
  children: React.ReactNode;
}) {
  const { enabled } = useSettings();
  if (!enabled(mod))
    return (
      <div className="card p-8 text-center text-gray-600">
        <div className="font-bold text-lg mb-2">Module disabled</div>
        <div>This feature is currently turned off. An admin can enable it in Settings.</div>
      </div>
    );
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/accept-invite/:token" element={<AcceptInvite />} />
          <Route
            path="/profile"
            element={
              <Protected>
                <Profile />
              </Protected>
            }
          />
          <Route
            path="/"
            element={
              <Protected>
                <Today />
              </Protected>
            }
          />
          <Route
            path="/insights"
            element={
              <Protected>
                <ModuleGate mod="dashboard">
                  <Dashboard />
                </ModuleGate>
              </Protected>
            }
          />
          <Route
            path="/pipeline"
            element={
              <Protected>
                <Pipeline />
              </Protected>
            }
          />
          <Route
            path="/opportunities/:id"
            element={
              <Protected>
                <OpportunityDetail />
              </Protected>
            }
          />
          <Route
            path="/analytics"
            element={
              <Protected>
                <ModuleGate mod="bid_analytics">
                  <BidAnalytics />
                </ModuleGate>
              </Protected>
            }
          />
          <Route
            path="/workload"
            element={
              <Protected>
                <ModuleGate mod="estimator_workload">
                  <EstimatorWorkload />
                </ModuleGate>
              </Protected>
            }
          />
          <Route
            path="/customers"
            element={
              <Protected>
                <ModuleGate mod="customer_mgmt">
                  <Customers />
                </ModuleGate>
              </Protected>
            }
          />
          <Route
            path="/contacts"
            element={
              <Protected>
                <ModuleGate mod="contacts">
                  <Contacts />
                </ModuleGate>
              </Protected>
            }
          />
          <Route
            path="/compliance"
            element={
              <Protected>
                <ModuleGate mod="compliance">
                  <Compliance />
                </ModuleGate>
              </Protected>
            }
          />
          <Route
            path="/backlog"
            element={
              <Protected>
                <ModuleGate mod="backlog">
                  <Backlog />
                </ModuleGate>
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <Protected>
                <AdminSettings />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SettingsProvider>
    </AuthProvider>
  );
}
