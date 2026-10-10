import { useRef, useState } from 'react'
import type { DashboardConfig } from '../../lib/storageTypes'
import { downloadBackupFile, parseConfigJson } from '../../lib/dashboardStorage'

interface RawConfigModalProps {
  isOpen: boolean
  onClose: () => void
  config: DashboardConfig
  onSaveConfig: (newConfig: DashboardConfig) => void
  onResetToDefault: () => void
  onSaveToSourceFile?: () => Promise<{ ok: boolean; message: string }>
}

export default function RawConfigModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetToDefault,
  onSaveToSourceFile,
}: RawConfigModalProps) {
  const [jsonText, setJsonText] = useState<string>(() => JSON.stringify(config, null, 2))
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [successMsg, setSuccessMsg] = useState<string>('')
  const [isSavingSource, setIsSavingSource] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleSave = () => {
    try {
      setErrorMsg('')
      const parsed = parseConfigJson(jsonText)
      onSaveConfig(parsed)
      setSuccessMsg('Đã lưu cấu hình vào LocalStorage!')
      setTimeout(() => {
        setSuccessMsg('')
        onClose()
      }, 800)
    } catch (err) {
      setErrorMsg((err as Error).message || 'Cú pháp JSON không hợp lệ.')
    }
  }

  const handleSaveToSource = async () => {
    try {
      setErrorMsg('')
      setIsSavingSource(true)
      const parsed = parseConfigJson(jsonText)
      onSaveConfig(parsed)
      if (onSaveToSourceFile) {
        const result = await onSaveToSourceFile()
        if (result.ok) {
          setSuccessMsg(result.message)
        } else {
          setErrorMsg(result.message)
        }
      }
    } catch (err) {
      setErrorMsg((err as Error).message || 'Cú pháp JSON không hợp lệ.')
    } finally {
      setIsSavingSource(false)
    }
  }

  const handleExport = () => {
    downloadBackupFile(config)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const parsed = parseConfigJson(content)
        setJsonText(JSON.stringify(parsed, null, 2))
        setErrorMsg('')
        setSuccessMsg(`Đã nạp file "${file.name}" thành công! Hãy bấm "Lưu cấu hình".`)
      } catch (err) {
        setErrorMsg('File JSON không hợp lệ: ' + (err as Error).message)
      }
    }
    reader.readAsText(file)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText)
    setSuccessMsg('Đã sao chép toàn bộ JSON vào clipboard!')
    setTimeout(() => setSuccessMsg(''), 2000)
  }

  const handleReset = () => {
    if (window.confirm('Bạn có chắc chắn muốn khôi phục Dashboard về cấu hình mặc định ban đầu?')) {
      onResetToDefault()
      onClose()
    }
  }

  return (
    <div
      style={{ zIndex: 1150 }}
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
    >
      <div onClick={onClose} className="fixed inset-0 bg-black/75 backdrop-blur-sm" />

      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border-strong)',
        }}
        className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl border shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div
          style={{ borderColor: 'var(--border-soft)' }}
          className="flex items-center justify-between border-b px-6 py-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                Raw Configuration & Sao Lưu (JSON Storage)
              </h2>
              <span className="sk-tag sk-tag--dev">STORAGE MODE</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Xem, chỉnh sửa trực tiếp mã JSON, lưu vào mã nguồn dự án hoặc xuất file backup ra máy.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm btn-icon text-lg">
            ✕
          </button>
        </div>

        {/* Action Toolbar */}
        <div
          style={{
            backgroundColor: 'var(--surface-2)',
            borderColor: 'var(--border-soft)',
          }}
          className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveToSource}
              disabled={isSavingSource}
              className="btn btn-primary btn-sm bg-[var(--green)] text-black font-semibold border-transparent"
              title="Ghi đè cấu hình hiện tại vào src/data/defaultDashboard.json"
            >
              <span>{isSavingSource ? '⏳ Đang lưu...' : '💾 Lưu vào file mã nguồn (defaultDashboard.json)'}</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="btn btn-secondary btn-sm"
              title="Tải file .json về máy/USB"
            >
              ⬇️ Xuất file Backup
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary btn-sm"
              title="Nạp file .json từ máy"
            >
              ⬆️ Nhập file Backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-soft btn-sm"
              title="Copy JSON vào clipboard"
            >
              📋 Sao chép
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="btn btn-danger btn-sm"
            title="Khôi phục về mẫu ban đầu của mã nguồn"
          >
            🔄 Khôi phục mặc định
          </button>
        </div>

        {/* JSON Editor Body */}
        <div className="flex-1 p-6 space-y-3 overflow-hidden flex flex-col">
          {errorMsg && (
            <div className="sk-state sk-state--red w-full p-2 text-xs">
              ⚠️ Lỗi: {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="sk-state sk-state--green w-full p-2 text-xs">
              ✓ {successMsg}
            </div>
          )}

          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value)
              setErrorMsg('')
            }}
            spellCheck={false}
            style={{
              backgroundColor: 'var(--bg-code)',
              color: 'var(--text-code)',
              borderColor: 'var(--border)',
            }}
            className="flex-1 w-full min-h-[300px] rounded-lg border p-4 font-mono text-xs leading-relaxed outline-none resize-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Footer */}
        <div
          style={{ borderColor: 'var(--border-soft)' }}
          className="flex items-center justify-between border-t px-6 py-4"
        >
          <span className="font-mono text-xs flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
            <span>Tự động lưu vào LocalStorage & File defaultDashboard.json</span>
          </span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Đóng
            </button>
            <button type="button" onClick={handleSave} className="btn btn-primary">
              Lưu Cấu Hình JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

