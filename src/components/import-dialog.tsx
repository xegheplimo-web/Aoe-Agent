'use client';

import { useId, useState, type DragEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  FileJson2,
  FolderOpen,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import type { DiagnosticRecord, RunRecord } from '@/lib/agent-types';

type Props = {
  kind: 'run' | 'diagnostic';
  onClose: () => void;
  onCreated: (item: RunRecord | DiagnosticRecord) => void;
};

export function ImportDialog({ kind, onClose, onCreated }: Props) {
  const inputId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [label, setLabel] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isRun = kind === 'run';

  function receiveFiles(incoming: File[]) {
    setError('');
    setFiles(incoming);
    if (!label && incoming.length) {
      const directory = incoming[0].webkitRelativePath?.split('/').at(-2);
      const time = new Date().toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      setLabel(directory || `${isRun ? 'Phiên chạy' : 'Chẩn đoán'} · ${time}`);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    receiveFiles(Array.from(event.dataTransfer.files));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length) {
      setError('Hãy chọn file trước khi nhập.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let url: string;
      let payload: Record<string, unknown>;
      if (isRun) {
        const eventsFile =
          files.find((file) => file.name.toLowerCase() === 'events.jsonl') ||
          files.find((file) => file.name.toLowerCase().endsWith('.jsonl'));
        const summaryFile = files.find((file) => file.name.toLowerCase() === 'summary.json');
        const exitFile = files.find((file) => file.name.toLowerCase() === 'exit.txt');
        if (!eventsFile && !summaryFile) {
          throw new Error('Cần events.jsonl hoặc summary.json của một phiên chạy.');
        }
        url = '/api/runs';
        payload = {
          label: label.trim(),
          sourceName: eventsFile?.name || summaryFile?.name,
          eventsJsonl: eventsFile ? await eventsFile.text() : undefined,
          summary: summaryFile ? JSON.parse(await summaryFile.text()) : undefined,
          exitReason: exitFile ? await exitFile.text() : undefined,
        };
      } else {
        const reportFile =
          files.find((file) => file.name.toLowerCase() === 'report.json') ||
          files.find((file) => file.name.toLowerCase().endsWith('.json'));
        if (!reportFile) throw new Error('Cần report.json từ thư mục diagnostics/.');
        url = '/api/diagnostics';
        payload = { label: label.trim(), report: JSON.parse(await reportFile.text()) };
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không nhập được dữ liệu.');
      onCreated(isRun ? (result.run as RunRecord) : (result.diagnostic as DiagnosticRecord));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'File không hợp lệ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose} role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-icon">
            <FileJson2 size={22} />
          </div>
          <button className="icon-button" type="button" aria-label="Đóng" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div className="eyebrow">NHẬP ARTIFACT · {isRun ? 'RUNS' : 'DIAGNOSTICS'}</div>
        <h2 id="import-title">{isRun ? 'Nhập một phiên chạy' : 'Nhập báo cáo chẩn đoán'}</h2>
        <p className="modal-description">
          {isRun
            ? 'Chọn events.jsonl và tùy chọn summary.json, exit.txt từ cùng một thư mục phiên.'
            : 'Chọn report.json do diagnose.py tạo. Có thể là ảnh offline hoặc capture trực tiếp.'}
        </p>
        <form onSubmit={submit}>
          <div
            className={`dropzone ${dragging ? 'dragging' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragging(false);
            }}
            onDrop={handleDrop}
          >
            <input
              id={inputId}
              type="file"
              multiple={isRun}
              accept={isRun ? '.jsonl,.json,.txt' : '.json'}
              onChange={(event) => receiveFiles(Array.from(event.target.files || []))}
            />
            <div className="drop-icon">
              <UploadCloud size={24} strokeWidth={1.8} />
            </div>
            <strong>
              Kéo file vào đây hoặc <label htmlFor={inputId}>chọn từ máy</label>
            </strong>
            <span>
              {isRun ? 'events.jsonl · summary.json · exit.txt' : 'diagnostics/…/report.json'}
            </span>
          </div>
          {files.length > 0 && (
            <div className="selected-files">
              <FolderOpen size={16} />
              <span>{files.map((file) => file.name).join('  ·  ')}</span>
            </div>
          )}
          <label className="field-label" htmlFor="import-label">
            Tên hiển thị
          </label>
          <input
            id="import-label"
            className="text-input"
            value={label}
            maxLength={180}
            placeholder={isRun ? 'Ví dụ: Thử nghiệm nhà chính #1' : 'Ví dụ: UI không chọn gì'}
            onChange={(event) => setLabel(event.target.value)}
          />
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>Chỉ lưu số liệu và sự kiện đã chuẩn hóa. Ảnh PNG không được tải lên.</span>
          </div>
          {error && (
            <div className="form-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button className="button-secondary" type="button" onClick={onClose}>
              Hủy
            </button>
            <button className="button-primary" type="submit" disabled={busy}>
              {busy ? <LoaderCircle size={16} className="spin" /> : <UploadCloud size={16} />}
              {busy ? 'Đang nhập...' : 'Nhập dữ liệu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
