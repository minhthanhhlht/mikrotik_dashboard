interface ToggleProps {
  on: boolean
  onChange: () => void
  disabled?: boolean
  accent?: 'accent' | 'cyan' | 'green' | 'amber' | 'violet'
}

/**
 * Switch Toggle chuẩn ServerKit với design tokens
 */
export default function Toggle({
  on,
  onChange,
  disabled,
  accent = 'accent',
}: ToggleProps) {
  const getActiveBg = () => {
    switch (accent) {
      case 'green':
        return 'var(--green)'
      case 'cyan':
        return 'var(--cyan)'
      case 'amber':
        return 'var(--amber)'
      case 'violet':
        return 'var(--violet)'
      default:
        return 'var(--accent)'
    }
  }

  const getGlow = () => {
    switch (accent) {
      case 'green':
        return '0 0 10px rgba(61, 220, 151, 0.4)'
      case 'cyan':
        return '0 0 10px rgba(73, 199, 240, 0.4)'
      case 'amber':
        return '0 0 10px rgba(245, 185, 69, 0.4)'
      case 'violet':
        return '0 0 10px rgba(176, 123, 245, 0.4)'
      default:
        return '0 0 10px var(--accent-glow)'
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      style={{
        backgroundColor: on ? getActiveBg() : 'var(--surface-3)',
        borderColor: on ? 'transparent' : 'var(--border-strong)',
        boxShadow: on ? getGlow() : 'none',
      }}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-all duration-200 ease-in-out items-center',
        disabled && 'cursor-not-allowed opacity-50',
      ].filter(Boolean).join(' ')}
    >
      <span
        style={{
          backgroundColor: on ? '#ffffff' : 'var(--text-dim)',
          transform: on ? 'translateX(22px)' : 'translateX(3px)',
        }}
        className="inline-block h-4 w-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm"
      />
    </button>
  )
}
