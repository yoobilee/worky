export type ReportStatus = "pending" | "inprogress" | "complete" | "stopped";
export type DayStatus    = "done" | "failed";
export type SortOrder    = "status" | "expiry" | "contractStart_asc" | "contractStart_desc" | "name_asc" | "name_desc" | "contact_asc" | "contact_desc";

export interface HistoryEntry {
  date:   string;
  status: ReportStatus;
}

export interface CustomField {
  key:    string;
  value:  string;
  masked: boolean;
}

export interface Client {
  id:               string;
  name:             string;
  status:           ReportStatus;
  contact:          string;
  phone:            string;
  link:             string;
  tags:             string[];
  contractStart:    string;
  contractDays:     number | null;
  reportTone:       string;
  memo:             string;
  statusHistory:    HistoryEntry[];
  dailyLog:         Record<string, DayStatus>;
  showGrassGrid:    boolean;
  maskPhone:        boolean;
  companyPhone:     string;
  maskCompanyPhone: boolean;
  customFields:     CustomField[];
  createdAt:        number;
}

export interface FormState {
  name:             string;
  status:           ReportStatus;
  contact:          string;
  phone:            string;
  link:             string;
  tagInput:         string;
  tags:             string[];
  contractStart:    string;
  contractDays:     string;
  contractDaysUnit: "days" | "weeks" | "months" | "years";
  reportTone:       string;
  memo:             string;
  showGrassGrid:    boolean;
  maskPhone:        boolean;
  companyPhone:     string;
  maskCompanyPhone: boolean;
  customFields:     CustomField[];
}

export const ALL_COLUMNS = [
  { key: "contact",       label: "담당자" },
  { key: "phone",         label: "담당자 연락처" },
  { key: "companyPhone",  label: "거래처 연락처" },
  { key: "tags",          label: "태그" },
  { key: "contractStart", label: "계약 시작일" },
  { key: "contractEnd",   label: "계약 만료일" },
  { key: "dday",          label: "D-day" },
  { key: "memo",          label: "메모" },
  { key: "reportTone",    label: "보고 톤" },
] as const;

export type ColumnKey = typeof ALL_COLUMNS[number]["key"];
export type ViewMode  = "grid" | "list";

export const CONTRACT_UNIT_LABELS: Record<FormState["contractDaysUnit"], string> = {
  days: "일", weeks: "주", months: "월", years: "년",
};

export const EMPTY_FORM: FormState = {
  name: "", status: "pending", contact: "", phone: "",
  link: "", tagInput: "", tags: [], contractStart: "",
  contractDays: "", contractDaysUnit: "days", reportTone: "", memo: "",
  showGrassGrid: false, maskPhone: false,
  companyPhone: "", maskCompanyPhone: false,
  customFields: [],
};

export const STATUS_CONFIG: Record<ReportStatus, {
  label: string; textCls: string; bgCls: string; borderCls: string; hoverCls: string; barCls: string;
}> = {
  pending: {
    label:     "대기 중",
    textCls:   "text-slate-500 dark:text-slate-400",
    bgCls:     "bg-slate-100 dark:bg-zinc-800",
    borderCls: "border-slate-200 dark:border-zinc-700",
    hoverCls:  "hover:bg-slate-200 dark:hover:bg-zinc-700",
    barCls:    "bg-slate-300 dark:bg-zinc-600",
  },
  inprogress: {
    label:     "진행 중",
    textCls:   "text-blue-600 dark:text-blue-400",
    bgCls:     "bg-blue-100 dark:bg-blue-950/40",
    borderCls: "border-blue-200 dark:border-blue-800",
    hoverCls:  "hover:bg-blue-200 dark:hover:bg-blue-900/60",
    barCls:    "bg-blue-500",
  },
  complete: {
    label:     "완료",
    textCls:   "text-emerald-600 dark:text-emerald-400",
    bgCls:     "bg-emerald-100 dark:bg-emerald-950/40",
    borderCls: "border-emerald-200 dark:border-emerald-800",
    hoverCls:  "hover:bg-emerald-200 dark:hover:bg-emerald-900/60",
    barCls:    "bg-emerald-500",
  },
  stopped: {
    label:     "중단",
    textCls:   "text-red-500 dark:text-red-400",
    bgCls:     "bg-red-100 dark:bg-red-950/40",
    borderCls: "border-red-200 dark:border-red-800",
    hoverCls:  "hover:bg-red-200 dark:hover:bg-red-900/60",
    barCls:    "bg-red-400",
  },
};

