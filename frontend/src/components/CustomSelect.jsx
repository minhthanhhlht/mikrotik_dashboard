import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * CustomSelect — ServerKit Infra Console Dropdown component
 * Replaces native unstyled HTML <select> with a theme-aware dropdown.
 */
export default function CustomSelect({
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Chọn…',
  className = '',
  buttonClassName = '',
  searchable = false,
  disabled = false,
  'aria-label': ariaLabel,
}) {
  const autoId = useId();
  const selectId = id || autoId;
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: String(opt), label: String(opt) };
      }
      return {
        value: String(opt.value ?? ''),
        label: opt.label ?? opt.name ?? String(opt.value ?? ''),
        sublabel: opt.sublabel || opt.comment || '',
        badge: opt.badge || '',
        icon: opt.icon || null,
        disabled: !!opt.disabled,
      };
    });
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return normalizedOptions;
    const q = searchTerm.trim().toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, searchable, searchTerm]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, searchable]);

  function handleKeyDown(e) {
    if (disabled) return;
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    } else if (e.key === 'ArrowDown' && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    }
  }

  function handleSelect(opt) {
    if (opt.disabled) return;
    setIsOpen(false);
    if (onChange) {
      const syntheticEvent = {
        target: { name: name || selectId, value: opt.value },
        currentTarget: { name: name || selectId, value: opt.value },
      };
      onChange(syntheticEvent, opt);
    }
  }

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block text-left ${className}`}
      onKeyDown={handleKeyDown}
    >
      <input type="hidden" id={selectId} name={name} value={value ?? ''} />

      <button
        type="button"
        id={`${selectId}-button`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`group flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--text)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bg)] disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen
            ? 'border-[var(--accent)] bg-[var(--surface)] ring-2 ring-[var(--accent-bg)]'
            : ''
        } ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 truncate min-w-0 text-left">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className={`truncate ${!selectedOption ? 'text-[var(--text-ghost)] font-normal' : 'text-[var(--text)] font-medium'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="rounded bg-[var(--accent-bg)] px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase text-[var(--accent-bright)] shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </span>

        <span
          className={`shrink-0 text-[var(--text-faint)] transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--accent)]' : 'group-hover:text-[var(--text-dim)]'
          }`}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute left-0 z-50 mt-1 min-w-full w-max max-w-[min(100vw-2rem,480px)] origin-top rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-2)] p-1 shadow-[var(--shadow-lg)] ring-1 ring-black/10"
        >
          {searchable && (
            <div className="p-1 border-b border-[var(--border-soft)] mb-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm…"
                className="w-full rounded-[var(--radius-sm)] bg-[var(--surface-3)] border border-[var(--border)] py-1.5 px-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-ghost)] focus:bg-[var(--surface)] focus:border-[var(--accent)] focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-0.5 p-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs font-mono text-[var(--text-faint)]">
                Không tìm thấy tùy chọn phù hợp
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    className={`group flex w-full items-center justify-between gap-3 rounded-[calc(var(--radius-sm)-2px)] px-3 py-2 text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-[var(--accent-bg)] font-semibold text-[var(--accent-bright)]'
                        : opt.disabled
                        ? 'cursor-not-allowed opacity-40 text-[var(--text-ghost)]'
                        : 'text-[var(--text)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="min-w-0">
                        <div className="truncate font-medium">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="text-[10px] font-mono text-[var(--text-faint)] truncate">
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                            isSelected
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--surface-3)] text-[var(--text-dim)]'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-3.5 w-3.5 text-[var(--accent)] shrink-0"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
