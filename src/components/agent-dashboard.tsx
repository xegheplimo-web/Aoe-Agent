'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  Command,
  Crosshair,
  FileClock,
  FileJson2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  Menu,
  Monitor,
  MoreHorizontal,
  Plus,
  ScanLine,
  Search,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Sparkles,
  Target,
  Terminal,
  Trash2,
  UploadCloud,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { DiagnosticRecord, DiagnosticSample, RunRecord, StateField } from '@/lib/agent-types';
import { STATE_FIELDS } from '@/lib/agent-types';
import { ImportDialog } from '@/components/import-dialog';
import { LocalImageInspector } from '@/components/local-image-inspector';
import { DocsView, WorkflowView } from '@/components/workflow-content';

type View = 'overview' | 'runs' | 'diagnostics' | 'workflow' | 'docs';
type ImportKind = 'run' | 'diagnostic';

const navigation: { id: View; label: string; icon: LucideIcon; caption?: string }[] = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'runs', label: 'Phiên chạy', icon: FileClock },
  { id: 'diagnostics', label: 'Chẩn đoán', icon: ScanLine },
  { id: 'workflow', label: 'Quy trình', icon: ListChecks },
  { id: 'docs', label: 'Tài liệu', icon: BookOpen },
];

const checklist = [
  { title: 'Môi trường & unit test đã qua', detail: 'pip check và unittest không báo lỗi' },
  { title: 'Scenario được kiểm soát', detail: 'Một nhà chính, hàng đợi rỗng, không giao tranh' },
  { title: 'Calibration đúng cửa sổ', detail: 'ROI, độ phân giải, civilization, giá dân đã ghi' },
  { title: 'Ảnh đúng được đối chiếu', detail: 'OCR và cả hai ảnh mẫu khớp bằng mắt' },
  { title: 'Ảnh sai bị từ chối', detail: 'Chọn dân/công trình khác, ít nhất một UI check trượt' },
  { title: 'Dry run không gửi lệnh', detail: 'Không có action_issued trong nhật ký' },
  { title: 'Sẵn sàng giám sát live', detail: 'F9, focus, không giữ phím/nút chuột' },
];

const fieldLabels: Record<StateField, string> = {
  food: 'Thực',
  wood: 'Gỗ',
  gold: 'Vàng',
  stone: 'Đá',
  pop_used: 'Dân hiện tại',
  pop_cap: 'Sức chứa',
};

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function countLabel(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function ModeBadge({ live }: { live: boolean | null }) {
  return (
    <span className={`mode-badge ${live === true ? 'live' : live === false ? 'dry' : 'neutral'}`}>
      <span className="badge-dot" />
      {live === true ? 'Live' : live === false ? 'Dry run' : 'Chưa rõ'}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={24} strokeWidth={1.65} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && onAction && (
        <button className="button-outline" type="button" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
  icon: Icon,
  color = 'teal',
}: {
  label: string;
  value: string | number;
  caption: string;
  icon: LucideIcon;
  color?: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <div className={`metric-icon ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-caption">
        <span className="tiny-dash" />
        {caption}
      </div>
    </div>
  );
}

function Overview({
  runs,
  diagnostics,
  ready,
  toggleReady,
  navigate,
  openImport,
  selectRun,
  selectDiagnostic,
}: {
  runs: RunRecord[];
  diagnostics: DiagnosticRecord[];
  ready: boolean[];
  toggleReady: (index: number) => void;
  navigate: (view: View) => void;
  openImport: (kind: ImportKind) => void;
  selectRun: (id: string) => void;
  selectDiagnostic: (id: string) => void;
}) {
  const issued = runs.reduce((total, run) => total + run.commandsIssued, 0);
  const confirmed = runs.reduce((total, run) => total + run.confirmed, 0);
  const samples = diagnostics.reduce((total, report) => total + report.sampleCount, 0);
  const readyCount = ready.filter(Boolean).length;
  const latest = diagnostics[0];

  return (
    <div className="overview-view">
      <div className="section-intro">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> AOE1 AGENT / CONTROL ROOM
          </div>
          <h1>Tổng quan thử nghiệm</h1>
          <p>Một không gian để quan sát, đối chiếu và nghiệm thu agent v0.1.</p>
        </div>
        <span className="version-tag">
          <span /> BẢN THỬ NGHIỆM V0.1
        </span>
      </div>

      <section className="hero-card">
        <div className="hero-content">
          <span className="hero-kicker">
            <Crosshair size={15} /> OBSERVE → VERIFY → ACT
          </span>
          <h2>
            Từng lệnh,
            <br />
            <em>một bằng chứng.</em>
          </h2>
          <p>
            Chỉ xin từng dân trong scenario được kiểm soát. Kiểm chứng giao diện trước khi bấm; kiểm
            chứng dân số trước khi tiếp tục.
          </p>
          <button className="hero-button" type="button" onClick={() => navigate('workflow')}>
            Xem quy trình nghiệm thu <ArrowRight size={17} />
          </button>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-frame-tag">
            <span className="pulse-dot" /> FRAME / ILLUSTRATION
          </div>
          <div className="hero-roi hero-roi-tc">
            <span>ROI / TC_MARKER</span>
          </div>
          <div className="hero-roi hero-roi-action">
            <span>VERIFY / UI</span>
          </div>
          <div className="hero-frame-bottom">
            NO LIVE CONTROL FROM WEB <span>01 / 03</span>
          </div>
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="PHIÊN ĐÃ NHẬP"
          value={countLabel(runs.length)}
          caption="Nhật ký trong workspace"
          icon={FileClock}
        />
        <MetricCard
          label="LỆNH ĐÃ GỬI"
          value={countLabel(issued)}
          caption="Không đồng nghĩa game đã nhận"
          icon={Command}
          color="amber"
        />
        <MetricCard
          label="DÂN ĐƯỢC XÁC NHẬN"
          value={countLabel(confirmed)}
          caption="Theo điều kiện của policy"
          icon={Users}
          color="blue"
        />
        <MetricCard
          label="MẪU CHẨN ĐOÁN"
          value={countLabel(samples)}
          caption="Từ report.json đã nhập"
          icon={ScanLine}
          color="purple"
        />
      </div>

      <div className="overview-grid">
        <section className="surface-card recent-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">01 / SESSION LOG</span>
              <h3>Phiên chạy gần đây</h3>
            </div>
            <button className="text-link" onClick={() => navigate('runs')} type="button">
              Xem tất cả <ArrowRight size={15} />
            </button>
          </div>
          {runs.length ? (
            <div className="recent-list">
              {runs.slice(0, 4).map((run) => (
                <button
                  key={run.id}
                  className="recent-row"
                  type="button"
                  onClick={() => {
                    selectRun(run.id);
                    navigate('runs');
                  }}
                >
                  <div className="recent-icon">
                    <FileText size={18} />
                  </div>
                  <div className="recent-main">
                    <strong>{run.label}</strong>
                    <span>
                      {dateLabel(run.createdAt)} · {timeLabel(run.createdAt)} &nbsp;·&nbsp;{' '}
                      {run.observationCount} quan sát
                    </span>
                  </div>
                  <ModeBadge live={run.live} />
                  <ChevronRight size={17} className="recent-chevron" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="Chưa có phiên nào"
              description="Nhập events.jsonl hoặc summary.json từ runs/ để bắt đầu đối chiếu."
              action="Nhập nhật ký"
              onAction={() => openImport('run')}
            />
          )}
          <div className="card-footnote">
            <ShieldCheck size={15} /> Chỉ hiển thị dữ liệu bạn chủ động nhập từ máy Windows.
          </div>
        </section>

        <section className="surface-card readiness-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">02 / SAFETY GATE</span>
              <h3>Trước khi chạy live</h3>
            </div>
            <div
              className="progress-ring"
              style={{
                background: `conic-gradient(#2f8c78 ${(readyCount / checklist.length) * 360}deg, #e8eeea 0deg)`,
              }}
            >
              <span>
                {readyCount}/{checklist.length}
              </span>
            </div>
          </div>
          <p className="readiness-hint">Đánh dấu sau khi tự kiểm tra trên máy của bạn.</p>
          <div className="checklist-mini">
            {checklist.slice(0, 5).map((item, index) => (
              <label key={item.title} className={`check-row ${ready[index] ? 'checked' : ''}`}>
                <input type="checkbox" checked={ready[index]} onChange={() => toggleReady(index)} />
                <span className="custom-check">{ready[index] && <Check size={13} />}</span>
                <span>{item.title}</span>
              </label>
            ))}
          </div>
          <button type="button" className="readiness-more" onClick={() => navigate('workflow')}>
            Xem đầy đủ 8 bước nghiệm thu <ArrowRight size={15} />
          </button>
        </section>
      </div>

      <div className="overview-bottom-grid">
        <section className="surface-card flow-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">03 / CONTROL LOOP</span>
              <h3>Luồng xử lý có kiểm chứng</h3>
            </div>
            <span className="small-tag">MỘT LỆNH / LẦN</span>
          </div>
          <div className="flow-steps">
            {[
              ['01', 'Quan sát', 'Ảnh + OCR', ScanLine],
              ['02', 'Chọn', 'Nhà chính', Target],
              ['03', 'Xác minh', 'Ảnh mẫu UI', ShieldCheck],
              ['04', 'Gửi lệnh', 'Đúng 1 dân', Command],
              ['05', 'Đối chiếu', 'Dân số +1', CheckCheck],
            ].map(([number, title, detail, Icon], index) => {
              const StepIcon = Icon as LucideIcon;
              return (
                <div className="flow-step" key={number as string}>
                  <div className={`flow-icon ${index === 3 ? 'flow-action' : ''}`}>
                    <StepIcon size={19} />
                  </div>
                  <small>
                    {number as string} / {title as string}
                  </small>
                  <strong>{detail as string}</strong>
                  {index < 4 && <ArrowRight size={16} className="flow-arrow" />}
                </div>
              );
            })}
          </div>
        </section>
        <section className="surface-card diagnostic-preview">
          <div className="card-heading">
            <div>
              <span className="card-kicker">04 / VISION CHECK</span>
              <h3>Chẩn đoán mới nhất</h3>
            </div>
            <button
              className="small-icon-button"
              type="button"
              onClick={() => navigate('diagnostics')}
              aria-label="Xem chẩn đoán"
            >
              <ArrowUpRight size={18} />
            </button>
          </div>
          {latest ? (
            <button
              className="latest-diagnostic"
              type="button"
              onClick={() => {
                selectDiagnostic(latest.id);
                navigate('diagnostics');
              }}
            >
              <div className="latest-diagnostic-top">
                <span
                  className={`status-indicator ${latest.status === 'analysis_finished' ? 'good' : 'warn'}`}
                />
                <strong>{latest.label}</strong>
              </div>
              <div className="latest-diagnostic-stats">
                <span>
                  <b>{latest.sampleCount}</b> mẫu
                </span>
                <span>
                  <b>{latest.uiFailures}</b> không khớp UI
                </span>
              </div>
              <div className="latest-diagnostic-foot">
                {dateLabel(latest.createdAt)} · Xem chi tiết <ArrowRight size={14} />
              </div>
            </button>
          ) : (
            <div className="diagnostic-empty">
              <div className="diagnostic-empty-icon">
                <ScanLine size={22} />
              </div>
              <strong>Chưa có ảnh được phân tích</strong>
              <span>Chạy diagnose.py và nhập report.json.</span>
              <button type="button" onClick={() => openImport('diagnostic')}>
                Nhập báo cáo <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>
      </div>
      <div className="bottom-note">
        <CircleAlert size={16} /> Web là nơi đọc artifact. Capture, OCR và thao tác game chỉ chạy
        trong các script Python trên Windows.
      </div>
    </div>
  );
}

function RunDetails({
  run,
  loading,
  onDelete,
}: {
  run: RunRecord | null;
  loading: boolean;
  onDelete: () => void;
}) {
  if (loading)
    return (
      <div className="detail-placeholder">
        <Activity size={22} className="spin" /> Đang đọc sự kiện...
      </div>
    );
  if (!run)
    return (
      <div className="detail-placeholder">
        <FileText size={27} /> Chọn một phiên để xem chi tiết.
      </div>
    );
  const timeline = (run.events || [])
    .filter(
      (event) =>
        event.type === 'action_issued' ||
        event.type === 'action_blocked' ||
        event.type === 'observation',
    )
    .slice(-12)
    .reverse();
  return (
    <div className="run-detail-content">
      <div className="detail-head">
        <div>
          <span className="card-kicker">SESSION DETAIL</span>
          <h3>{run.label}</h3>
        </div>
        <button
          className="small-icon-button danger"
          type="button"
          onClick={onDelete}
          title="Xóa bản nhập"
          aria-label="Xóa bản nhập"
        >
          <Trash2 size={17} />
        </button>
      </div>
      <div className="detail-meta">
        <ModeBadge live={run.live} />
        <span>
          {dateLabel(run.createdAt)} · {timeLabel(run.createdAt)}
        </span>
      </div>
      <div className="detail-counter-grid">
        <div>
          <small>LỆNH ĐÃ GỬI</small>
          <strong>{run.commandsIssued}</strong>
        </div>
        <div>
          <small>POLICY XÁC NHẬN</small>
          <strong>{run.confirmed}</strong>
        </div>
        <div>
          <small>OCR UNKNOWN</small>
          <strong>{run.unknownOcr}</strong>
        </div>
      </div>
      <div className="detail-block">
        <div className="detail-block-title">Trạng thái cuối</div>
        <div className="state-grid">
          {STATE_FIELDS.map((field) => (
            <div key={field}>
              <span>{fieldLabels[field]}</span>
              <strong>{run.lastState?.[field] ?? '—'}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="exit-panel">
        <span>
          <CircleAlert size={15} /> LÝ DO DỪNG
        </span>
        <p>{run.exitReason}</p>
      </div>
      {run.corruptLines.length > 0 && (
        <div className="warning-strip">
          <CircleAlert size={15} /> Dòng JSONL không đọc được:{' '}
          {run.corruptLines.slice(0, 15).join(', ')}
        </div>
      )}
      <div className="detail-block timeline-block">
        <div className="detail-block-title">
          Nhật ký gần nhất <span>{run.events?.length || 0} sự kiện</span>
        </div>
        {timeline.length ? (
          <div className="timeline-list">
            {timeline.map((event, index) => (
              <div className="timeline-entry" key={`${event.elapsed}-${index}`}>
                <span
                  className={`timeline-node ${event.type === 'action_issued' ? 'issued' : event.action === 'STOP' || event.type === 'action_blocked' ? 'stop' : ''}`}
                />
                <div>
                  <div className="timeline-title">
                    <strong>
                      {event.type === 'action_issued'
                        ? 'Đã gửi lệnh'
                        : event.type === 'action_blocked'
                          ? 'Đã chặn thao tác'
                          : event.action || 'Quan sát'}
                    </strong>
                    <small>
                      {typeof event.elapsed === 'number' ? `${event.elapsed.toFixed(1)}s` : '—'}
                    </small>
                  </div>
                  <p>
                    {event.reason ||
                      (event.type === 'action_issued'
                        ? 'TRAIN_VILLAGER · chưa phải bằng chứng game đã nhận.'
                        : event.state
                          ? `Thực ${event.state.food ?? '?'} · Dân ${event.state.pop_used ?? '?'}/${event.state.pop_cap ?? '?'}`
                          : '—')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-small">
            Bản nhập từ summary.json không có timeline. Hãy nhập events.jsonl nếu cần xem từng quan
            sát.
          </p>
        )}
      </div>
      <p className="detail-caveat">
        <ShieldOff size={14} /> Lệnh đã gửi ≠ lệnh game đã nhận. Kiểm tra PNG trong thư mục phiên.
      </p>
    </div>
  );
}

function RunsView({
  runs,
  selectedId,
  selectRun,
  detail,
  loading,
  openImport,
  deleteRun,
}: {
  runs: RunRecord[];
  selectedId: string | null;
  selectRun: (id: string) => void;
  detail: RunRecord | null;
  loading: boolean;
  openImport: () => void;
  deleteRun: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'live' | 'dry'>('all');
  const [query, setQuery] = useState('');
  const visible = runs.filter(
    (run) =>
      (filter === 'all' || (filter === 'live' ? run.live === true : run.live === false)) &&
      run.label.toLocaleLowerCase('vi-VN').includes(query.toLocaleLowerCase('vi-VN')),
  );
  return (
    <div className="inner-view">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow">SESSION ARCHIVE / 02</div>
          <h1 className="page-title">Phiên chạy</h1>
          <p className="page-subtitle">
            Đọc log quyết định và đối chiếu từng lệnh với bằng chứng trong phiên.
          </p>
        </div>
        <button className="button-primary" type="button" onClick={openImport}>
          <Plus size={17} /> Nhập phiên mới
        </button>
      </div>
      <div className="runs-layout">
        <section className="surface-card runs-list-card">
          <div className="list-toolbar">
            <div className="segmented-control">
              {(['all', 'live', 'dry'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={filter === option ? 'active' : ''}
                  onClick={() => setFilter(option)}
                >
                  {option === 'all' ? 'Tất cả' : option === 'live' ? 'Live' : 'Dry run'}
                </button>
              ))}
            </div>
            <span className="list-count">{visible.length} phiên</span>
          </div>
          <div className="search-wrap">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên phiên..."
              aria-label="Tìm phiên chạy"
            />
          </div>
          {visible.length ? (
            <div className="session-list">
              {visible.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  className={`session-row ${selectedId === run.id ? 'selected' : ''}`}
                  onClick={() => selectRun(run.id)}
                >
                  <div className="session-row-top">
                    <strong>{run.label}</strong>
                    <ChevronRight size={16} />
                  </div>
                  <div className="session-row-sub">
                    <ModeBadge live={run.live} />
                    <span>{dateLabel(run.createdAt)}</span>
                  </div>
                  <div className="session-row-numbers">
                    <span>
                      <b>{run.observationCount}</b> quan sát
                    </span>
                    <span>
                      <b>{run.commandsIssued}</b> lệnh gửi
                    </span>
                    <span>
                      <b>{run.confirmed}</b> xác nhận
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileJson2}
              title={runs.length ? 'Không tìm thấy phiên' : 'Chưa nhập phiên chạy'}
              description={
                runs.length
                  ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.'
                  : 'Chọn events.jsonl hoặc summary.json từ thư mục runs/.'
              }
              action={runs.length ? undefined : 'Nhập nhật ký'}
              onAction={openImport}
            />
          )}
        </section>
        <section className="surface-card run-detail-card">
          <RunDetails run={detail} loading={loading} onDelete={deleteRun} />
        </section>
      </div>
    </div>
  );
}

function SampleDetail({ sample, threshold }: { sample: DiagnosticSample; threshold: number }) {
  return (
    <div className="sample-detail">
      <div className="sample-detail-header">
        <div>
          <span className="card-kicker">{sample.directory.toUpperCase()}</span>
          <h4>Kết quả phân tích</h4>
        </div>
        <span className={`sample-result ${sample.ui_matches_threshold ? 'match' : 'no-match'}`}>
          {sample.ui_matches_threshold ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
          {sample.ui_matches_threshold ? 'UI khớp' : 'UI không khớp'}
        </span>
      </div>
      <div className="sample-metadata">
        <span>
          <Clock3 size={14} /> OCR{' '}
          {sample.ocr_seconds === null ? '—' : `${sample.ocr_seconds.toFixed(2)}s`}
        </span>
        <span>
          <Activity size={14} /> Frame std{' '}
          {sample.frame_std === null ? '—' : sample.frame_std.toFixed(1)}
        </span>
      </div>
      <div className="detail-block-title">Số đọc từ OCR</div>
      <div className="sample-state-grid">
        {STATE_FIELDS.map((field) => (
          <div key={field}>
            <span>{fieldLabels[field]}</span>
            <strong className={sample.state[field] === null ? 'unknown-value' : ''}>
              {sample.state[field] ?? 'None'}
            </strong>
          </div>
        ))}
      </div>
      <div className="detail-block-title ui-heading">
        Điểm giao diện <span>Ngưỡng {threshold.toFixed(2)}</span>
      </div>
      {Object.entries(sample.ui_scores).length ? (
        Object.entries(sample.ui_scores).map(([name, score]) => (
          <div className="score-row" key={name}>
            <div>
              <span>{name}</span>
              <strong className={score >= threshold ? 'score-good' : 'score-low'}>
                {score.toFixed(3)}
              </strong>
            </div>
            <div className="score-track">
              <span
                style={{ width: `${Math.max(0, Math.min(100, score * 100))}%` }}
                className={score >= threshold ? 'pass' : 'fail'}
              />
            </div>
          </div>
        ))
      ) : (
        <p className="muted-small">Không có điểm UI trong mẫu này.</p>
      )}
      <div className="sample-image-note">
        <Monitor size={16} /> Xem frame.png, annotated.png và các crop tại {sample.directory}/ trên
        máy Windows. Ảnh không được tải lên web.
      </div>
    </div>
  );
}

function DiagnosticsView({
  diagnostics,
  selectedId,
  selectDiagnostic,
  openImport,
  deleteDiagnostic,
}: {
  diagnostics: DiagnosticRecord[];
  selectedId: string | null;
  selectDiagnostic: (id: string) => void;
  openImport: () => void;
  deleteDiagnostic: () => void;
}) {
  const report = diagnostics.find((item) => item.id === selectedId) || diagnostics[0];
  const [sampleIndex, setSampleIndex] = useState(0);
  const sample = report?.samples[sampleIndex] || report?.samples[0];
  return (
    <div className="inner-view">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow">VISION LAB / 03</div>
          <h1 className="page-title">Chẩn đoán giao diện</h1>
          <p className="page-subtitle">
            Đọc OCR và điểm ảnh mẫu. Luôn kiểm tra lại frame và crop bằng mắt.
          </p>
        </div>
        <button className="button-primary" type="button" onClick={openImport}>
          <Plus size={17} /> Nhập report.json
        </button>
      </div>
      <div className="diagnostics-layout">
        <section className="surface-card diagnostic-list-card">
          <div className="list-title">
            <h3>Báo cáo đã nhập</h3>
            <span>{diagnostics.length.toString().padStart(2, '0')}</span>
          </div>
          {diagnostics.length ? (
            <div className="report-list">
              {diagnostics.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`report-row ${report?.id === item.id ? 'selected' : ''}`}
                  onClick={() => selectDiagnostic(item.id)}
                >
                  <div className="report-row-top">
                    <span className={`report-mini-icon ${item.status === 'error' ? 'error' : ''}`}>
                      <ScanLine size={17} />
                    </span>
                    <strong>{item.label}</strong>
                    <ChevronRight size={15} />
                  </div>
                  <div className="report-row-bottom">
                    <span>{dateLabel(item.createdAt)}</span>
                    <span>{item.sampleCount} mẫu</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ScanLine}
              title="Chưa có báo cáo"
              description="Chạy diagnose.py trên máy Windows, sau đó nhập report.json."
              action="Nhập báo cáo"
              onAction={openImport}
            />
          )}
          <div className="diagnostic-help">
            <Terminal size={16} />
            <code>.\.venv\Scripts\python.exe diagnose.py --count 3</code>
          </div>
        </section>
        <section className="surface-card diagnostic-detail-card">
          {report ? (
            <>
              <div className="detail-head">
                <div>
                  <span className="card-kicker">REPORT DETAIL</span>
                  <h3>{report.label}</h3>
                </div>
                <button
                  className="small-icon-button danger"
                  type="button"
                  onClick={deleteDiagnostic}
                  title="Xóa báo cáo"
                  aria-label="Xóa báo cáo"
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="diagnostic-report-meta">
                <span
                  className={`report-status ${report.status === 'analysis_finished' ? 'done' : 'issue'}`}
                >
                  <span />
                  {report.status}
                </span>
                <span>{report.source === 'live' ? 'Capture trực tiếp' : 'Phân tích offline'}</span>
                <span>
                  {report.clientSize ? report.clientSize.join(' × ') : 'Kích thước chưa rõ'}
                </span>
              </div>
              {report.error && (
                <div className="warning-strip">
                  <CircleAlert size={16} />
                  {report.error}
                </div>
              )}
              <div className="diagnostic-kpis">
                <div>
                  <small>SỐ MẪU</small>
                  <strong>{report.sampleCount}</strong>
                </div>
                <div>
                  <small>UI KHÔNG KHỚP</small>
                  <strong>{report.uiFailures}</strong>
                </div>
                <div>
                  <small>OCR UNKNOWN</small>
                  <strong>{report.unknownFields}</strong>
                </div>
                <div>
                  <small>OCR TB</small>
                  <strong>
                    {report.meanOcrSeconds === null ? '—' : `${report.meanOcrSeconds.toFixed(2)}s`}
                  </strong>
                </div>
              </div>
              <div className="sample-selector-label">CHỌN MẪU PHÂN TÍCH</div>
              {report.samples.length ? (
                <div className="sample-tabs">
                  {report.samples.map((item, index) => (
                    <button
                      type="button"
                      key={`${item.directory}-${index}`}
                      className={sampleIndex === index ? 'selected' : ''}
                      onClick={() => setSampleIndex(index)}
                    >
                      <span
                        className={`sample-tab-dot ${item.ui_matches_threshold ? 'pass' : 'fail'}`}
                      />
                      #{String(index).padStart(3, '0')}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="muted-small">Báo cáo không có mẫu ảnh.</div>
              )}
              {sample && <SampleDetail sample={sample} threshold={report.threshold} />}
              <LocalImageInspector />
              <p className="detail-caveat">
                <CircleAlert size={14} /> analysis_finished chỉ có nghĩa đã phân tích xong; không
                bảo đảm OCR đúng.
              </p>
            </>
          ) : (
            <div className="detail-placeholder">
              <ScanLine size={27} /> Chọn một báo cáo để xem điểm OCR và UI.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function AgentDashboard({
  initialRuns,
  initialDiagnostics,
  storageReady,
}: {
  initialRuns: RunRecord[];
  initialDiagnostics: DiagnosticRecord[];
  storageReady: boolean;
}) {
  const [view, setView] = useState<View>('overview');
  const [runs, setRuns] = useState(initialRuns);
  const [diagnostics, setDiagnostics] = useState(initialDiagnostics);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRuns[0]?.id || null);
  const [selectedDiagnosticId, setSelectedDiagnosticId] = useState<string | null>(
    initialDiagnostics[0]?.id || null,
  );
  const [runDetail, setRunDetail] = useState<RunRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [importKind, setImportKind] = useState<ImportKind | null>(null);
  const [ready, setReady] = useState<boolean[]>(Array(checklist.length).fill(false));
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('aoe1-readiness-v01') || '[]');
      if (Array.isArray(saved)) setReady(checklist.map((_, index) => saved[index] === true));
    } catch {
      /* Local storage is optional. */
    }
    const syncHash = () => {
      const fragment = window.location.hash.slice(1);
      if (navigation.some((item) => item.id === fragment)) setView(fragment as View);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    fetch(`/api/runs/${selectedRunId}`)
      .then((response) =>
        response.json().then((data) => {
          if (!response.ok) throw new Error(data.error || 'Không đọc được phiên.');
          return data.run as RunRecord;
        }),
      )
      .then((run) => {
        if (active) setRunDetail(run);
      })
      .catch(() => {
        if (active) setRunDetail(null);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedRunId]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }
  function navigate(next: View) {
    setView(next);
    setMenuOpen(false);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function toggleReady(index: number) {
    setReady((previous) => {
      const next = [...previous];
      next[index] = !next[index];
      try {
        window.localStorage.setItem('aoe1-readiness-v01', JSON.stringify(next));
      } catch {
        /* optional */
      }
      return next;
    });
  }
  function handleCreated(item: RunRecord | DiagnosticRecord) {
    if (importKind === 'run') {
      const run = item as RunRecord;
      setRuns((previous) => [run, ...previous]);
      setSelectedRunId(run.id);
      navigate('runs');
      notify('Đã lưu phiên chạy. Hãy đối chiếu ảnh trong thư mục runs/.');
    } else {
      const diagnostic = item as DiagnosticRecord;
      setDiagnostics((previous) => [diagnostic, ...previous]);
      setSelectedDiagnosticId(diagnostic.id);
      navigate('diagnostics');
      notify('Đã lưu báo cáo chẩn đoán.');
    }
    setImportKind(null);
  }
  async function deleteRun() {
    if (
      !selectedRunId ||
      !window.confirm(
        'Xóa bản nhập phiên này khỏi dashboard? File trên máy Windows sẽ không bị xóa.',
      )
    )
      return;
    try {
      const response = await fetch(`/api/runs/${selectedRunId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      const remaining = runs.filter((item) => item.id !== selectedRunId);
      setRuns(remaining);
      setSelectedRunId(remaining[0]?.id || null);
      notify('Đã xóa bản nhập phiên chạy.');
    } catch {
      notify('Không xóa được bản nhập. Hãy thử lại.');
    }
  }
  async function deleteDiagnostic() {
    if (
      !selectedDiagnosticId ||
      !window.confirm('Xóa báo cáo này khỏi dashboard? File gốc không bị xóa.')
    )
      return;
    try {
      const response = await fetch(`/api/diagnostics/${selectedDiagnosticId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error();
      const remaining = diagnostics.filter((item) => item.id !== selectedDiagnosticId);
      setDiagnostics(remaining);
      setSelectedDiagnosticId(remaining[0]?.id || null);
      notify('Đã xóa báo cáo khỏi dashboard.');
    } catch {
      notify('Không xóa được báo cáo. Hãy thử lại.');
    }
  }
  const currentLabel = navigation.find((item) => item.id === view)?.label || 'Tổng quan';

  return (
    <div className="app-shell">
      {menuOpen && (
        <button
          className="mobile-backdrop"
          type="button"
          onClick={() => setMenuOpen(false)}
          aria-label="Đóng menu"
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Crosshair size={25} strokeWidth={1.7} />
          </div>
          <div className="brand-wordmark">
            <strong>
              AEGIS<span>.</span>
            </strong>
            <small>AOE1 AGENT LAB</small>
          </div>
        </div>
        <div className="sidebar-rule" />
        <div className="sidebar-caption">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`nav-item ${view === item.id ? 'active' : ''}`}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
                {view === item.id && <span className="active-pip" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-status">
          <div className="sidebar-status-head">
            <span className="status-led" /> CHẾ ĐỘ AN TOÀN
          </div>
          <p>Web chỉ đọc nhật ký. Input game chỉ chạy từ Python trên máy Windows.</p>
          <span className="sidebar-status-version">SCENARIO-ONLY · V0.1</span>
        </div>
        <div className="sidebar-footer">
          <span>BUILT FOR EVIDENCE</span>
          <span>01 / 01</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle"
              type="button"
              aria-label="Mở menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{currentLabel}</strong>
          </div>
          <div className="topbar-right">
            <div className="topbar-mode">
              <span /> OFFLINE-FIRST
            </div>
            <div className="topbar-divider" />
            <button
              className="top-import-button"
              type="button"
              onClick={() => setImportKind('run')}
            >
              <UploadCloud size={17} /> Nhập nhật ký
            </button>
            <div className="profile-chip" title="AoE1 Agent Lab">
              A1
            </div>
          </div>
        </header>
        <main className="main-content">
          {!storageReady && (
            <div className="storage-warning">
              <CircleAlert size={17} /> Chưa đọc được bảng dữ liệu. Kiểm tra PostgreSQL và chạy npx
              drizzle-kit push.
            </div>
          )}
          {view === 'overview' && (
            <Overview
              runs={runs}
              diagnostics={diagnostics}
              ready={ready}
              toggleReady={toggleReady}
              navigate={navigate}
              openImport={setImportKind}
              selectRun={setSelectedRunId}
              selectDiagnostic={setSelectedDiagnosticId}
            />
          )}
          {view === 'runs' && (
            <RunsView
              runs={runs}
              selectedId={selectedRunId}
              selectRun={setSelectedRunId}
              detail={runDetail}
              loading={detailLoading}
              openImport={() => setImportKind('run')}
              deleteRun={deleteRun}
            />
          )}
          {view === 'diagnostics' && (
            <DiagnosticsView
              key={selectedDiagnosticId ?? 'none'}
              diagnostics={diagnostics}
              selectedId={selectedDiagnosticId}
              selectDiagnostic={setSelectedDiagnosticId}
              openImport={() => setImportKind('diagnostic')}
              deleteDiagnostic={deleteDiagnostic}
            />
          )}
          {view === 'workflow' && <WorkflowView notify={notify} />}
          {view === 'docs' && <DocsView notify={notify} />}
          <footer className="main-footer">
            <span>AEGIS / AOE1 AGENT LAB</span>
            <span>Quan sát → Xin từng dân → Kiểm chứng trong scenario có kiểm soát</span>
            <span>V0.1</span>
          </footer>
        </main>
      </div>
      {importKind && (
        <ImportDialog
          kind={importKind}
          onClose={() => setImportKind(null)}
          onCreated={handleCreated}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={18} />
          {toast}
          <button type="button" onClick={() => setToast('')} aria-label="Đóng thông báo">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
