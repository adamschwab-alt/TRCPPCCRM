import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

interface SavedView {
  id: number;
  name: string;
  scope: "PRIVATE" | "TEAM" | "ORG";
  ownerId: number | null;
  filtersJson: string;
  isPinned: boolean;
}

interface Props {
  currentFilters: Record<string, any>;
  onApply: (filters: Record<string, any>) => void;
  activeFiltersDescribe: string;
}

export default function SavedViews({ currentFilters, onApply, activeFiltersDescribe }: Props) {
  const { user } = useAuth();
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"PRIVATE" | "TEAM" | "ORG">("PRIVATE");

  async function load() {
    try { setViews(await api("/api/saved-views")); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!name.trim()) return;
    await api("/api/saved-views", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), scope, filters: currentFilters }),
    });
    setName("");
    setShowSave(false);
    await load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this view?")) return;
    await api(`/api/saved-views/${id}`, { method: "DELETE" });
    if (activeId === id) setActiveId(null);
    await load();
  }

  function apply(v: SavedView) {
    try {
      const f = JSON.parse(v.filtersJson);
      onApply(f);
      setActiveId(v.id);
    } catch {}
  }

  function applyAll() {
    onApply({});
    setActiveId(null);
  }

  const hasFilters = Object.values(currentFilters).some((v) => v !== "" && v !== null && v !== undefined);

  return (
    <div className="border-b border-gray-200 flex flex-wrap items-center gap-1 pb-1">
      <button
        onClick={applyAll}
        className={`px-3 py-1.5 text-xs font-semibold rounded-t ${activeId === null ? "bg-redland-charcoal text-white" : "text-gray-700 hover:bg-gray-100"}`}
      >
        All bids
      </button>
      {views.map((v) => (
        <div key={v.id} className="flex items-center group">
          <button
            onClick={() => apply(v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t ${activeId === v.id ? "bg-redland-charcoal text-white" : "text-gray-700 hover:bg-gray-100"}`}
            title={`${v.scope}${v.ownerId === user?.id ? " (yours)" : ""}`}
          >
            {v.name}
            {v.scope !== "PRIVATE" && (
              <span className="ml-1 text-[0.65rem] opacity-70">{v.scope === "ORG" ? "🌐" : "👥"}</span>
            )}
          </button>
          {(v.ownerId === user?.id || user?.role === "ADMIN") && (
            <button
              onClick={() => remove(v.id)}
              className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-red-700 px-1"
              title="Delete view"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {hasFilters && !showSave && (
        <button onClick={() => setShowSave(true)} className="ml-auto px-3 py-1.5 text-xs font-semibold text-redland-red hover:underline">
          + Save current view
        </button>
      )}
      {showSave && (
        <div className="ml-auto flex items-center gap-1">
          <input
            className="input text-xs py-1 max-w-[160px]"
            placeholder="View name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <select className="input text-xs py-1 max-w-[100px]" value={scope} onChange={(e) => setScope(e.target.value as any)}>
            <option value="PRIVATE">Private</option>
            <option value="TEAM">Team</option>
            <option value="ORG">Everyone</option>
          </select>
          <button onClick={save} className="btn-primary text-xs py-1">Save</button>
          <button onClick={() => setShowSave(false)} className="btn-ghost text-xs py-1">Cancel</button>
        </div>
      )}
    </div>
  );
}
