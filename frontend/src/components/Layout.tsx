import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useSettings } from "../settings";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { enabled } = useSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = useNavigate();

  const links: { to: string; label: string; show: boolean }[] = [
    { to: "/", label: "Today", show: true },
    { to: "/pipeline", label: "Pipeline", show: true },
    { to: "/insights", label: "Insights", show: enabled("dashboard") },
    { to: "/analytics", label: "Bid Analytics", show: enabled("bid_analytics") },
    { to: "/workload", label: "Workload", show: enabled("estimator_workload") },
    { to: "/customers", label: "Customers", show: enabled("customer_mgmt") },
    { to: "/contacts", label: "Contacts", show: enabled("contacts") },
    { to: "/compliance", label: "Compliance", show: enabled("compliance") },
    { to: "/backlog", label: "Backlog", show: enabled("backlog") },
    { to: "/integrations", label: "Integrations", show: enabled("integrations") },
  ];
  const isAdmin = user?.role === "ADMIN" || user?.role === "LEADERSHIP";

  return (
    <div className="min-h-screen flex flex-col bg-redland-gray">
      <header className="bg-redland-charcoal text-white shadow-md sticky top-0 z-30">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden p-2 rounded hover:bg-white/10"
              aria-label="Menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-redland-red rounded flex items-center justify-center font-extrabold text-lg">
                R
              </div>
              <div className="hidden sm:block">
                <div className="font-extrabold leading-tight">REDLAND</div>
                <div className="text-xs text-redland-gold font-semibold tracking-wider">CRM &amp; PIPELINE</div>
              </div>
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {links.filter((l) => l.show).map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-semibold ${
                    isActive
                      ? "bg-redland-red text-white"
                      : "text-white/80 hover:bg-white/10"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-semibold ${
                    isActive
                      ? "bg-redland-gold text-redland-charcoal"
                      : "text-redland-gold hover:bg-white/10"
                  }`
                }
              >
                Admin
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/profile" className="hidden sm:block text-right group">
              <div className="text-sm font-semibold group-hover:text-redland-gold">{user?.fullName}</div>
              <div className="text-xs text-white/70">{user?.role}</div>
            </Link>
            <Link to="/profile" className="sm:hidden text-white/80 hover:text-white text-sm font-semibold">
              Account
            </Link>
            <button onClick={logout} className="text-white/80 hover:text-white text-sm font-semibold">
              Log out
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav className="md:hidden border-t border-white/10 pb-2">
            {links.filter((l) => l.show).map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 text-sm font-semibold ${
                    isActive ? "bg-redland-red" : "hover:bg-white/10"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 text-sm font-semibold ${
                    isActive ? "bg-redland-gold text-redland-charcoal" : "text-redland-gold hover:bg-white/10"
                  }`
                }
              >
                Admin
              </NavLink>
            )}
          </nav>
        )}
      </header>
      <main className="flex-1 px-4 sm:px-6 py-6 max-w-[1600px] w-full mx-auto">
        {children}
      </main>
      <footer className="text-center text-xs text-gray-500 py-4">
        The Redland Company · CRM &amp; Pipeline Tracker
      </footer>
    </div>
  );
}
