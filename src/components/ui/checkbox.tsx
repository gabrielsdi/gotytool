"use client";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
}: CheckboxProps) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <div className="relative flex items-center mt-0.5">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center ${
            checked
              ? "bg-amber-500 border-amber-500"
              : "bg-zinc-800 border-zinc-600 group-hover:border-zinc-500"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {checked && (
            <svg
              className="w-3 h-3 text-black"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </div>
      </div>
      <div className="select-none">
        <span className="text-sm text-zinc-300 group-hover:text-zinc-200 transition-colors">
          {label}
        </span>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}
