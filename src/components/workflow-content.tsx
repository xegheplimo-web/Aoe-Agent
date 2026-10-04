'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  Archive,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCopy,
  Cpu,
  HardDriveDownload,
  Info,
  Layers3,
  Map,
  Monitor,
  ShieldAlert,
  Terminal,
  TriangleAlert,
} from 'lucide-react';

type Props = { notify: (message: string) => void };

type Step = {
  letter: string;
  title: string;
  description: string;
  command?: string;
  verify: string;
  tone?: 'warning' | 'normal';
};

const steps: Step[] = [
  {
    letter: 'A',
    title: 'Kiểm tra môi trường và logic',
    description: 'Chỉ đi tiếp khi dependency tương thích và toàn bộ unit test đều qua.',
    command: String.raw`.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m unittest discover -s tests -v`,
    verify: 'Không còn lỗi pip check hay unittest.',
  },
  {
    letter: 'B',
    title: 'Dựng scenario có kiểm soát',
    description:
      'Một nhà chính, đủ thực và chỗ dân, hàng đợi rỗng, không giao tranh hay tác động làm đổi dân số.',
    verify: 'Đọc giá xin dân từ giao diện của civilization đang thử.',
  },
  {
    letter: 'C',
    title: 'Calibration cho giao diện hiện tại',
    description:
      'Chọn ROI tài nguyên, dân số, dấu nhận biết nhà chính và nút xin dân đang khả dụng.',
    command: String.raw`.\.venv\Scripts\python.exe calibrate.py`,
    verify: 'config.json và ba ảnh trong assets/ được tạo đúng kích thước.',
  },
  {
    letter: 'D',
    title: 'Chẩn đoán cả mẫu đúng lẫn mẫu sai',
    description:
      'Kiểm tra frame, annotated, từng crop OCR; thử cả khi chọn dân, công trình khác và không chọn gì.',
    command: String.raw`.\.venv\Scripts\python.exe diagnose.py --count 3`,
    verify: 'Ảnh đúng đạt ngưỡng; ảnh sai phải có ít nhất một UI check không đạt.',
  },
  {
    letter: 'E',
    title: 'Dry run — không gửi input',
    description: 'Quan sát quyết định policy trước. Chế độ mặc định của run.py là dry run.',
    command: String.raw`.\.venv\Scripts\python.exe run.py --seconds 30
.\.venv\Scripts\python.exe report.py`,
    verify: 'Có thể thấy TRAIN_VILLAGER, nhưng commands_issued phải bằng 0.',
  },
  {
    letter: 'F',
    title: 'Live có giám sát',
    description:
      'Không làm việc khác trên máy. F9 đặt cờ dừng; giữ fail-safe PyAutoGUI. Một lệnh rồi chờ xác nhận.',
    command: String.raw`.\.venv\Scripts\python.exe run.py --live --seconds 180`,
    verify: 'Không phát lệnh bổ sung trong lúc chờ dân số tăng hoặc khi mất focus.',
    tone: 'warning',
  },
  {
    letter: 'G',
    title: 'Đối chiếu ảnh và nhật ký',
    description: 'So sánh số lệnh gửi, số dân được policy xác nhận, ảnh trước/sau và lý do dừng.',
    command: String.raw`.\.venv\Scripts\python.exe report.py`,
    verify: 'Không suy ra game đã nhận lệnh chỉ từ action_issued.',
  },
  {
    letter: 'H',
    title: 'Lặp lại và chụp môi trường',
    description:
      'Reset scenario thủ công sau mỗi lần thử. Khi ổn định mới chụp phiên bản thư viện trên máy Windows.',
    command: String.raw`.\.venv\Scripts\python.exe -m pip freeze --all | Set-Content -Encoding utf8 -Path .\requirements-lock.txt`,
    verify: 'Lưu thêm Tesseract, độ phân giải, scaling, civilization, giá dân và wrapper.',
  },
];

export function CopyCommand({ command, notify }: { command: string; notify: Props['notify'] }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      notify('Đã sao chép lệnh PowerShell.');
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      notify('Không thể sao chép tự động. Hãy chọn và sao chép lệnh thủ công.');
    }
  }
  return (
    <div className="command-box">
      <div className="command-label">
        <Terminal size={13} /> POWERSHELL
      </div>
      <pre>{command}</pre>
      <button type="button" className="copy-button" onClick={copy} aria-label="Sao chép lệnh">
        {copied ? <Check size={15} /> : <ClipboardCopy size={15} />}
      </button>
    </div>
  );
}

export function WorkflowView({ notify }: Props) {
  const [openStep, setOpenStep] = useState<string | null>('A');
  return (
    <div className="inner-view">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow">FIELD GUIDE / 04</div>
          <h1 className="page-title">Quy trình nghiệm thu</h1>
          <p className="page-subtitle">
            Tám chặng có điểm kiểm tra rõ ràng. Đi tuần tự, không bỏ qua bước chẩn đoán.
          </p>
        </div>
        <div className="heading-stamp">
          <Layers3 size={18} /> V0.1 · 8 BƯỚC
        </div>
      </div>
      <div className="workflow-layout">
        <div className="workflow-list">
          {steps.map((step, index) => (
            <div
              key={step.letter}
              className={`workflow-step ${openStep === step.letter ? 'expanded' : ''}`}
            >
              <button
                type="button"
                className="workflow-trigger"
                onClick={() => setOpenStep(openStep === step.letter ? null : step.letter)}
                aria-expanded={openStep === step.letter}
              >
                <span className="workflow-num">{step.letter}</span>
                <span className="workflow-trigger-text">
                  <small>CHẶNG {String(index + 1).padStart(2, '0')}</small>
                  <strong>{step.title}</strong>
                </span>
                <ChevronRight size={18} className="workflow-chevron" />
              </button>
              {openStep === step.letter && (
                <div className="workflow-body">
                  <p>{step.description}</p>
                  {step.command && <CopyCommand command={step.command} notify={notify} />}
                  <div className={`verify-line ${step.tone === 'warning' ? 'caution' : ''}`}>
                    {step.tone === 'warning' ? <TriangleAlert size={16} /> : <Check size={16} />}
                    <span>
                      <strong>Điểm kiểm tra:</strong> {step.verify}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <aside className="workflow-aside">
          <div className="aside-mark">
            <ShieldAlert size={22} />
          </div>
          <div className="eyebrow">NGUYÊN TẮC V0.1</div>
          <h3>
            Quan sát trước.
            <br />
            Hành động sau.
          </h3>
          <p>
            Chỉ một lệnh xin dân tại một thời điểm, trong scenario đã kiểm soát. Mọi kết quả phải
            được kiểm tra lại từ ảnh và trạng thái game.
          </p>
          <div className="aside-divider" />
          <div className="aside-item">
            <span>01</span> Không bấm khi mất focus
          </div>
          <div className="aside-item">
            <span>02</span> Không thay None bằng số giả
          </div>
          <div className="aside-item">
            <span>03</span> Không spam lệnh khi chờ
          </div>
          <div className="aside-item">
            <span>04</span> Không tự reset scenario
          </div>
        </aside>
      </div>
    </div>
  );
}

type Environment = {
  tesseract: string;
  resolution: string;
  scaling: string;
  civilization: string;
  cost: string;
  wrapper: string;
};
const emptyEnvironment: Environment = {
  tesseract: '',
  resolution: '',
  scaling: '',
  civilization: '',
  cost: '',
  wrapper: '',
};
const environmentFields: { key: keyof Environment; label: string; placeholder: string }[] = [
  { key: 'tesseract', label: 'Tesseract', placeholder: 'Ví dụ: 5.4.1' },
  { key: 'resolution', label: 'Cửa sổ game', placeholder: 'Ví dụ: 1280 × 720' },
  { key: 'scaling', label: 'Windows scaling', placeholder: 'Ví dụ: 100%' },
  { key: 'civilization', label: 'Civilization', placeholder: 'Ví dụ: Yamato' },
  { key: 'cost', label: 'Giá xin dân', placeholder: 'Theo giao diện game' },
  { key: 'wrapper', label: 'Wrapper đồ họa', placeholder: 'Không dùng / tên wrapper' },
];

const ENV_KEY = 'aoe1-environment-v01';
const subscribeNoop = () => () => {};
const getEnvironmentSnapshot = () => window.localStorage.getItem(ENV_KEY);
const getServerSnapshot = () => null;

function parseEnvironment(raw: string | null): Environment {
  if (!raw) return emptyEnvironment;
  try {
    return { ...emptyEnvironment, ...(JSON.parse(raw) as Partial<Environment>) };
  } catch {
    return emptyEnvironment;
  }
}

export function DocsView({ notify }: Props) {
  const storedEnvironment = useSyncExternalStore(
    subscribeNoop,
    getEnvironmentSnapshot,
    getServerSnapshot,
  );
  const [draft, setDraft] = useState<Environment | null>(null);
  const environment = draft ?? parseEnvironment(storedEnvironment);
  const [saved, setSaved] = useState(false);

  function saveEnvironment() {
    try {
      window.localStorage.setItem('aoe1-environment-v01', JSON.stringify(environment));
      setSaved(true);
      notify('Đã lưu ghi chú môi trường trong trình duyệt này.');
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      notify('Không thể lưu vào trình duyệt này.');
    }
  }

  return (
    <div className="inner-view">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow">REFERENCE / 05</div>
          <h1 className="page-title">Tài liệu & môi trường</h1>
          <p className="page-subtitle">
            Ghi lại những điều kiện khiến một phiên chạy có thể đối chiếu về sau.
          </p>
        </div>
        <div className="heading-stamp">
          <BookOpen size={18} /> BẢN THỬ NGHIỆM
        </div>
      </div>

      <div className="docs-grid">
        <section className="surface-card docs-environment">
          <div className="card-icon">
            <Monitor size={20} />
          </div>
          <h2>Phiếu môi trường</h2>
          <p>
            Ghi chú này chỉ lưu trong trình duyệt. `config.json` trên máy Windows vẫn là profile
            chính của agent.
          </p>
          <div className="environment-grid">
            {environmentFields.map((field) => (
              <label key={field.key} className="environment-field">
                <span>{field.label}</span>
                <input
                  value={environment[field.key]}
                  onChange={(event) =>
                    setDraft({ ...environment, [field.key]: event.target.value })
                  }
                  placeholder={field.placeholder}
                />
              </label>
            ))}
          </div>
          <button className="button-primary" onClick={saveEnvironment} type="button">
            {saved ? <Check size={16} /> : <Archive size={16} />}
            {saved ? 'Đã lưu' : 'Lưu ghi chú'}
          </button>
        </section>

        <section className="surface-card docs-lock">
          <div className="card-icon amber">
            <HardDriveDownload size={20} />
          </div>
          <h2>Chụp thư viện đang dùng</h2>
          <p>
            Chạy trên Windows sau khi môi trường ổn định. Không sao chép nguyên `.venv` sang máy
            khác.
          </p>
          <CopyCommand
            command={String.raw`.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pip freeze --all | Set-Content -Encoding utf8 -Path .\requirements-lock.txt`}
            notify={notify}
          />
          <div className="inline-callout">
            <Info size={16} /> `requirements-lock.txt` là bản chụp phiên bản, không phải lockfile có
            hash hay bảo đảm đa nền tảng.
          </div>
        </section>
      </div>

      <div className="docs-grid lower">
        <section className="surface-card">
          <div className="card-icon">
            <Cpu size={20} />
          </div>
          <h2>Đọc đúng các con số</h2>
          <div className="fact-list">
            <div>
              <strong>commands_issued</strong>
              <span>Ghi nhận lệnh đã gửi, chưa chứng minh game đã nhận.</span>
            </div>
            <div>
              <strong>confirmed_by_policy</strong>
              <span>Dân số tăng theo điều kiện demo, cần đối chiếu ảnh.</span>
            </div>
            <div>
              <strong>unknown_ocr_counts</strong>
              <span>Đếm giá trị None; bằng 0 không có nghĩa OCR luôn đúng.</span>
            </div>
            <div>
              <strong>UI score 0.97</strong>
              <span>Điểm sai khác ảnh, không phải xác suất 97%.</span>
            </div>
          </div>
        </section>
        <section className="surface-card">
          <div className="card-icon amber">
            <Map size={20} />
          </div>
          <h2>Lộ trình sau v0.1</h2>
          <div className="roadmap-list">
            {[
              ['v0.2', 'Giao dân khai thác'],
              ['v0.3', 'Xây nhà và xác nhận hoàn thành'],
              ['v0.4', 'Phân bổ kinh tế'],
              ['v0.5', 'Lên đời'],
              ['v0.6', 'Sản xuất và điều quân'],
            ].map(([version, title]) => (
              <div key={version}>
                <span>{version}</span>
                <strong>{title}</strong>
                <ArrowRight size={15} />
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="safety-banner">
        <ShieldAlert size={21} />
        <div>
          <strong>Giới hạn hiện tại</strong>
          <span>
            Agent không tự reset scenario, không chơi toàn trận và không chạy được phần desktop trên
            máy chủ web này.
          </span>
        </div>
      </div>
    </div>
  );
}
