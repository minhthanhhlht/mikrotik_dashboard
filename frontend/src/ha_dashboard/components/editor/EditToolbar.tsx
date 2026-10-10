interface EditToolbarProps {
  onAddCard: () => void
  onAddView: () => void
  onOpenRawConfig: () => void
  onDone: () => void
}

/**
 * Thanh công cụ nổi đáy màn hình khi ở chế độ Edit Mode
 */
export default function EditToolbar({
  onAddCard,
  onAddView,
  onOpenRawConfig,
  onDone,
}: EditToolbarProps) {
  return (
    <div
      style={{
        zIndex: 60,
      }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--surface-0)]/95 backdrop-blur-xl px-4 py-2 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-center gap-2 pr-2 border-r border-[var(--border-soft)] hidden sm:flex">
        <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-ping" />
        <span className="font-mono text-xs font-semibold text-[var(--accent-bright)]">
          CHẾ ĐỘ BIÊN TẬP
        </span>
      </div>

      <button
        type="button"
        onClick={onAddCard}
        className="btn btn-primary btn-sm"
      >
        <span>+ Thêm Thẻ</span>
      </button>

      <button
        type="button"
        onClick={onAddView}
        className="btn btn-secondary btn-sm"
      >
        <span>+ Thêm Tab</span>
      </button>

      <button
        type="button"
        onClick={onOpenRawConfig}
        className="btn btn-soft btn-sm"
        title="Mở trình soạn thảo JSON / Sao lưu & Khôi phục"
      >
        <span>⚙ Sao lưu & JSON</span>
      </button>

      <button
        type="button"
        onClick={onDone}
        className="btn btn-primary btn-sm bg-[var(--green)] border-transparent text-black font-semibold hover:opacity-90"
      >
        <span>✓ Hoàn tất</span>
      </button>
    </div>
  )
}

