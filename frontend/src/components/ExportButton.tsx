import React from "react";

interface Props {
  path: string;
  label?: string;
  className?: string;
}

// Auth-aware download. Browser <a href> can't carry the JWT, so we fetch
// the file as a blob with the bearer token attached.
export default function ExportButton({ path, label = "Export Excel", className = "btn-ghost" }: Props) {
  async function download() {
    const tok = localStorage.getItem("redland_token");
    const res = await fetch(path, { headers: { Authorization: `Bearer ${tok}` } });
    if (!res.ok) { alert("Download failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button onClick={download} className={className} type="button">
      ⬇ {label}
    </button>
  );
}
