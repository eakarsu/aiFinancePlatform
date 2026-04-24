import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

function SearchBar({ value = '', onChange, placeholder = 'Search...', debounceMs = 300 }) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalValue(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(val), debounceMs);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div className="search-bar">
      <Search size={16} className="search-bar-icon" />
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="search-bar-input"
      />
      {localValue && (
        <button className="search-bar-clear" onClick={handleClear} type="button">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default SearchBar;
