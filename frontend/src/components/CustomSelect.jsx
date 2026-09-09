import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * CustomSelect — Neon Glass Light Dropdown component
 * Replaces native unstyled HTML <select> with a beautiful frosted glassmorphism popover.
 *
 * @param {Object} props
 * @param {string} [props.id]
 * @param {string} [props.name]
 * @param {string} props.value - Currently selected value
 * @param {Function} props.onChange - Callback fn(value, optionObject)
 * @param {Array<Object|string>} props.options - List of options: [{ value, label, sublabel, badge, icon, disabled }] or string[]
 * @param {string} [props.placeholder='Chọn tùy chọn…']
 * @param {string} [props.className=''] - Container class
 * @param {string} [props.buttonClassName=''] - Trigger button override class
 * @param {boolean} [props.searchable=false] - Show search filter inside dropdown
 * @param {boolean} [props.disabled=false]
 * @param {string} [props['aria-label']]
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

  // Normalize options array to standard object format
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

  // Current selected option object
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  // Filter options if searchable
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

  // Close when clicking outside
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

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, searchable]);

  // Handle keyboard navigation
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
      // Create synthetic event-like object for compatibility
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
      {/* Hidden input for form accessibility / standard form capture */}
      <input type="hidden" id={selectId} name={name} value={value ?? ''} />

      {/* Trigger Button */}
      <button
        type="button"
        id={`${selectId}-button`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`group flex w-full items-center justify-between gap-2.5 rounded-xl border border-white/60 bg-white/70 px-3.5 py-2 text-xs font-semibold text-ink shadow-xs backdrop-blur-md transition-all hover:border-primary/50 hover:bg-white hover:shadow-[0_0_16px_rgba(0,132,255,0.2)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen
            ? 'border-primary/80 bg-white ring-2 ring-primary/20 shadow-[0_0_20px_rgba(0,132,255,0.25)]'
            : ''
        } ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 truncate min-w-0 text-left">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className={`truncate ${!selectedOption ? 'text-ink-faint font-normal' : 'text-ink font-bold'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </span>

        {/* Animated Chevron Arrow */}
        <span
          className={`shrink-0 text-ink-soft transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-primary' : 'group-hover:text-primary'
          }`}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
            <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {/* Floating Glass Dropdown Panel */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute left-0 z-50 mt-1.5 min-w-full w-max max-w-[min(100vw-2rem,480px)] origin-top rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(0,132,255,0.18),0_4px_16px_rgba(0,0,0,0.08)] backdrop-blur-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Search box if enabled */}
          {searchable && (
            <div className="p-1.5 pb-2 border-b border-ink/5">
              <div className="relative">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
                >
                  <circle cx="9" cy="9" r="5.5" />
                  <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm kiếm…"
                  className="w-full rounded-lg bg-ink/5 py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-faint focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 p-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-ink-faint">
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
                    className={`group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-primary-soft to-primary-soft/40 font-bold text-primary shadow-xs'
                        : opt.disabled
                        ? 'cursor-not-allowed opacity-40 text-ink-faint'
                        : 'text-ink hover:bg-primary-soft/60 hover:text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="text-[10px] text-ink-faint truncate font-normal">
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isSelected
                              ? 'bg-primary text-white shadow-[0_0_10px_rgba(0,132,255,0.5)]'
                              : 'bg-ink/5 text-ink-soft group-hover:bg-primary/20 group-hover:text-primary'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4 text-primary shrink-0"
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
