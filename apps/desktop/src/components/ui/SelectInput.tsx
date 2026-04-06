import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { SelectInputProps } from "../../models/selectInput.model";

/**
 * Custom styled select input matching the app's futuristic design system.
 * @param value - Currently selected value
 * @param options - Available options
 * @param onChange - Callback when selection changes
 * @param placeholder - Placeholder text when no value is selected
 */
export const SelectInput = ({ value, options, onChange, placeholder = "Sélectionner..." }: SelectInputProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedLabel = options.find(o => o.value === value)?.label ?? placeholder;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative w-full">
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className={`w-full flex items-center justify-between glass text-cyan-50 px-4 py-3 rounded-lg border transition-all font-medium text-left
                    ${isOpen
                        ? "border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
                        : "border-cyan-500/30 hover:border-cyan-500/50 hover:shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                    }`}
            >
                <span className={value ? "text-cyan-50" : "text-cyan-500/40"}>{selectedLabel}</span>
                <ChevronDown
                    size={16}
                    className={`text-cyan-500/60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {/* Options panel */}
            {isOpen && (
                <div className="absolute z-50 mt-1.5 w-full glass-modal rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar py-1">
                        {options.map(opt => {
                            const isSelected = opt.value === value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                    className={`w-full text-left px-4 py-2.5 text-[13px] font-medium transition-all flex items-center gap-2
                                        ${isSelected
                                            ? "bg-cyan-500/15 text-cyan-300"
                                            : "text-cyan-100/70 hover:bg-cyan-500/10 hover:text-cyan-50"
                                        }`}
                                >
                                    {/* Selection indicator */}
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${isSelected ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" : "bg-transparent"}`} />
                                    <span className="truncate">{opt.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

