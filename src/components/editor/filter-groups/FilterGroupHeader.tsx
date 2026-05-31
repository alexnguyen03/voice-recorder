import React from "react";

interface FilterGroupHeaderProps {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  activeCount: number;
  accentClass: string;
}

/** Expandable section header with active-count badge. SRP: only renders a header. */
export const FilterGroupHeader: React.FC<FilterGroupHeaderProps> = ({
  icon, label, open, onToggle, activeCount, accentClass,
}) => (
  <button
    onClick={onToggle}
    className="flex items-center gap-2 w-full py-2.5 px-1 text-left cursor-pointer group"
  >
    <span className={`text-sm transition-transform duration-200 ${open ? "rotate-90" : ""} text-slate-400 group-hover:text-slate-200`}>
      ▶
    </span>
    <span className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-colors flex-shrink-0">
      {icon}
    </span>
    <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400 group-hover:text-slate-200 transition-colors">
      {label}
    </span>
    {activeCount > 0 && (
      <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${accentClass}`}>
        {activeCount} ON
      </span>
    )}
  </button>
);
