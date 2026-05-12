import React from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;
  const sizes = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center overflow-y-auto p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full ${sizes[size]} my-8`}>
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-bold text-redland-charcoal">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-redland-red text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
