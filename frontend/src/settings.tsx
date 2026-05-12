import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";

interface SettingsCtx {
  settings: Record<string, string>;
  dropdowns: Record<string, string[]>;
  reload: () => Promise<void>;
  enabled: (mod: string) => boolean;
}

const Ctx = createContext<SettingsCtx>(null as any);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dropdowns, setDropdowns] = useState<Record<string, string[]>>({});

  const reload = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        api<Record<string, string>>("/api/settings"),
        api<Record<string, string[]>>("/api/dropdowns"),
      ]);
      setSettings(s);
      setDropdowns(d);
    } catch {
      // unauth or boot — ignore
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const enabled = (mod: string) => settings[`module_${mod}_enabled`] !== "false";

  return (
    <Ctx.Provider value={{ settings, dropdowns, reload, enabled }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSettings = () => useContext(Ctx);
