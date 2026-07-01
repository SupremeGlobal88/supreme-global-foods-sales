import { Calendar } from "lucide-react";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}

export default function DatePicker({ value, onChange, required = false, disabled = false, min, max, placeholder, className = "" }: DatePickerProps) {
  // Format display value
  const displayValue = value
    ? new Date(value).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })
    : placeholder || "Select date...";

  return (
    <div className={`relative ${className}`}>
      {/* Visible display with calendar icon */}
      <div
        className="input-field flex items-center justify-between cursor-pointer select-none"
        style={{ opacity: disabled ? 0.5 : 1 }}
        onClick={() => {
          if (!disabled) {
            const input = document.getElementById(`date-input-${Math.random().toString(36).slice(2)}`) as HTMLInputElement;
            if (input) input.showPicker();
          }
        }}
      >
        <span className={`text-sm font-body ${value ? "text-white" : "text-[#8A8B8C]"}`}>
          {displayValue}
        </span>
        <Calendar className="w-4 h-4 text-[#D4A843] flex-shrink-0" />
      </div>

      {/* Hidden actual date input that triggers the calendar */}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ zIndex: 1 }}
        onClick={(e) => {
          const target = e.target as HTMLInputElement;
          if (target.showPicker) target.showPicker();
        }}
      />
    </div>
  );
}
