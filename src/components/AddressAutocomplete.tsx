import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

interface AddressSuggestion {
  label: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  name?: string;
  context?: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = "Adresse",
  className,
  id,
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await res.json();
      const results: AddressSuggestion[] = (data.features || []).map((f: any) => ({
        label: f.properties.label,
        housenumber: f.properties.housenumber,
        street: f.properties.street,
        postcode: f.properties.postcode,
        city: f.properties.city,
        name: f.properties.name,
        context: f.properties.context,
      }));
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setHighlightedIndex(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    onChange(suggestion.label);
    setShowSuggestions(false);
    setSuggestions([]);
    onSelect?.(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border bg-popover shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm transition-colors ${
                i === highlightedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted text-popover-foreground"
              }`}
              onMouseEnter={() => setHighlightedIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
