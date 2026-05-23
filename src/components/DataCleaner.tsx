"use client";


import HelpButton from "./HelpButton";
import { useState, useRef, useEffect } from "react";
import EditableResult from "./EditableResult";
import { IconAlignLeft, IconFileUpload } from "@tabler/icons-react";
import { trackUsage } from "@/lib/usageStats";

type InputMode = "text" | "file";
type RawCell   = string | number | null;

/* ── 파일 → 전체 rows 파싱 (헤더 미지정) ── */
async function parseFileToRows(file: File): Promise<RawCell[][]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "csv" || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (res) => resolve(res.data as string[][]),
        error: reject,
        skipEmptyLines: false,
      });
    });
  }

  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, { type: "array", raw: true });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const ref  = ws["!ref"];
    if (!ref) return [];
    const range = XLSX.utils.decode_range(ref);

    const stripNewlines = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

    // cell.t 기준으로 값 추출 (cell.w 미사용)
    const readCell = (R: number, C: number): RawCell => {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell || cell.v == null) return null;
      if (cell.t === "s") return stripNewlines(String(cell.v));
      if (cell.t === "n") {
        const num = cell.v as number;
        if (num > 40000 && num < 60000) {
          const d = new Date(Math.round((num - 25569) * 86400 * 1000));
          return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
        }
        return num;
      }
      return stripNewlines(String(cell.v));
    };

    // range.e.c 전체 기준으로 모든 행 파싱 (lastCol은 applyHeaderRow에서 계산)
    const allRows: RawCell[][] = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
      const rowData: RawCell[] = [];
      for (let C = range.s.c; C <= range.e.c; C++) {
        rowData.push(readCell(R, C));
      }
      allRows.push(rowData);
    }
    return allRows;
  }

  throw new Error("지원하지 않는 파일 형식입니다. CSV 또는 Excel 파일을 업로드하세요.");
}

/* ── 헤더 행 적용 → { previewRows, confirmedText, rowCount } ── */
function applyHeaderRow(
  rawRows: RawCell[][],
  headerRowNum: number
): { previewRows: string[][]; confirmedText: string; rowCount: number } {
  const idx = headerRowNum - 1;
  if (idx < 0 || idx >= rawRows.length)
    throw new Error(`${headerRowNum}행은 파일 범위를 벗어납니다. (전체 ${rawRows.length}행)`);

  const headerRaw = rawRows[idx];

  // 헤더 행 기준 마지막 유효 컬럼 인덱스 계산 (trailing 빈 컬럼 제거)
  let lastValidCol = -1;
  for (let C = 0; C < headerRaw.length; C++) {
    if (headerRaw[C] !== null && String(headerRaw[C]).trim() !== "") lastValidCol = C;
  }
  if (lastValidCol === -1) throw new Error("헤더 행에 유효한 컬럼이 없습니다.");
  const colCount = lastValidCol + 1;

  const header = headerRaw.slice(0, colCount).map((c) => String(c ?? ""));
  const dataRows = rawRows
    .slice(idx + 1)
    .filter((row) => row.some((c) => c !== null && String(c).trim() !== ""))
    .map((row) => {
      const cells = row.slice(0, colCount).map((c) => String(c ?? ""));
      // 헤더보다 컬럼이 적으면 빈 문자열로 채우기
      while (cells.length < colCount) cells.push("");
      return cells;
    });

  // 직접 HTML 테이블 생성
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const theadHtml = `<thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`;
  const tbodyHtml = `<tbody>${dataRows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  const confirmedText = `<table>${theadHtml}${tbodyHtml}</table>`;

  // 미리보기용: 헤더 + 최대 3개 데이터 행 (string[][])
  const previewRows = [header, ...dataRows.slice(0, 3)];

  return { previewRows, confirmedText, rowCount: dataRows.length };
}

/* ── AI / 청크 처리 ── */
const SYSTEM_PROMPT = `당신은 데이터 정리 전문가입니다. 사용자가 붙여넣은 지저분한 텍스트나 데이터를 분석하여 깔끔한 HTML 표로 변환하세요.
반드시 <table> 태그로 시작하고 </table> 태그로 끝나는 HTML만 반환하세요.
마크다운 코드블록, 설명 텍스트는 절대 포함하지 마세요.
thead > tr > th 로 헤더를, tbody > tr > td 로 데이터를 구성하세요.`;

const CHUNK_SYSTEM_PROMPT = `당신은 데이터 정리 전문가입니다. 아래 CSV 데이터(헤더 포함)를 HTML 표로 변환하세요.
반드시 <table> 태그로 시작하고 </table> 태그로 끝나는 HTML만 반환하세요.
마크다운 코드블록, 설명 텍스트는 절대 포함하지 마세요.
thead > tr > th 로 헤더를, tbody > tr > td 로 데이터를 구성하세요.`;

const CHUNK_SIZE = 50;

function extractTableHtml(raw: string): string {
  const match = raw.match(/<table[\s\S]*<\/table>/i);
  return match ? match[0] : raw;
}

async function callGroqApi(text: string, systemPrompt: string): Promise<string> {
  const res = await fetch("/api/groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: text }],
      systemPrompt,
      max_tokens: 8192,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
  return data.result as string;
}

async function cleanDataWithChunks(
  sourceText: string,
  onProgress: (done: number, total: number) => void
): Promise<string> {
  // ── JSON 객체 배열 경로 (파일 업로드) ──
  if (sourceText.trimStart().startsWith("[")) {
    const objects = JSON.parse(sourceText) as Record<string, string>[];

    if (objects.length <= CHUNK_SIZE) {
      const raw = await callGroqApi(sourceText, SYSTEM_PROMPT);
      onProgress(1, 1);
      return extractTableHtml(raw);
    }

    const chunks: Record<string, string>[][] = [];
    for (let i = 0; i < objects.length; i += CHUNK_SIZE)
      chunks.push(objects.slice(i, i + CHUNK_SIZE));

    let theadHtml = "";
    const tbodyRows: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const raw       = await callGroqApi(JSON.stringify(chunks[i]), CHUNK_SYSTEM_PROMPT);
      const tableHtml = extractTableHtml(raw);
      if (i === 0) {
        const m = tableHtml.match(/<thead[\s\S]*?<\/thead>/i);
        theadHtml = m ? m[0] : "";
      }
      const tbodyMatch = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
      if (tbodyMatch) {
        const trs = tbodyMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
        tbodyRows.push(...trs);
      }
      onProgress(i + 1, chunks.length);
      if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 500));
    }

    return `<table>${theadHtml}<tbody>${tbodyRows.join("")}</tbody></table>`;
  }

  // ── 일반 텍스트 경로 (텍스트 입력 모드) ──
  const lines = sourceText.trim().split("\n");

  if (lines.length <= CHUNK_SIZE + 1) {
    const raw = await callGroqApi(sourceText, SYSTEM_PROMPT);
    onProgress(1, 1);
    return extractTableHtml(raw);
  }

  const header   = lines[0];
  const dataRows = lines.slice(1);
  const chunks: string[][] = [];
  for (let i = 0; i < dataRows.length; i += CHUNK_SIZE)
    chunks.push(dataRows.slice(i, i + CHUNK_SIZE));

  let theadHtml = "";
  const tbodyRows: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = [header, ...chunks[i]].join("\n");
    const raw       = await callGroqApi(chunkText, CHUNK_SYSTEM_PROMPT);
    const tableHtml = extractTableHtml(raw);
    if (i === 0) {
      const m = tableHtml.match(/<thead[\s\S]*?<\/thead>/i);
      theadHtml = m ? m[0] : "";
    }
    const tbodyMatch = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
    if (tbodyMatch) {
      const trs = tbodyMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
      tbodyRows.push(...trs);
    }
    onProgress(i + 1, chunks.length);
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 500));
  }

  return `<table>${theadHtml}<tbody>${tbodyRows.join("")}</tbody></table>`;
}

function tableHtmlToCSV(html: string): string {
  const doc  = new DOMParser().parseFromString(html, "text/html");
  const rows = doc.querySelectorAll("tr");
  return Array.from(rows)
    .map((row) =>
      Array.from(row.querySelectorAll("th, td"))
        .map((cell) => {
          const text = (cell.textContent ?? "")
            .replace(/\r\n|\r|\n/g, " ")  // 셀 내 줄바꿈 → 공백
            .replace(/"/g, '""');          // 큰따옴표 이스케이프
          return `"${text}"`;
        })
        .join(",")
    )
    .join("\n");
}

const CLEAN_COUNT_KEY = "worky_clean_count";
const LAST_CLEAN_KEY  = "worky_last_clean";

function formatLastClean(iso: string | null): string {
  if (!iso) return "기록 없음";
  const then = new Date(iso);
  const now  = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thenStart  = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const diffDays   = Math.round((todayStart.getTime() - thenStart.getTime()) / 86400000);
  if (diffDays === 0) {
    const hh = String(then.getHours()).padStart(2, "0");
    const mm = String(then.getMinutes()).padStart(2, "0");
    return `오늘 ${hh}:${mm}`;
  }
  if (diffDays === 1) return "어제";
  return `${diffDays}일 전`;
}

/* ── 미리보기 테이블 ── */
function PreviewTable({ rows }: { rows: string[][] }) {
  if (rows.length === 0) return null;
  const [header, ...data] = rows;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700 mt-2">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-white bg-[#6C63FF] whitespace-nowrap">
                {h || <span className="opacity-40">(빈 열)</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? "bg-slate-50 dark:bg-zinc-800/50" : ""}>
              {header.map((_, ci) => (
                <td key={ci} className="px-3 py-2 text-slate-700 dark:text-zinc-300 border-b border-slate-100 dark:border-zinc-800 whitespace-nowrap">
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export default function DataCleaner() {
  const [inputMode,      setInputMode]      = useState<InputMode>("text");
  const [input,          setInput]          = useState("");
  const [file,           setFile]           = useState<File | null>(null);
  const [rawRows,        setRawRows]        = useState<RawCell[][] | null>(null);
  const [headerInput,    setHeaderInput]    = useState("1");
  const [headerConfirmed,  setHeaderConfirmed]  = useState(false);
  const [confirmedText,    setConfirmedText]    = useState("");
  const [confirmedRowCount, setConfirmedRowCount] = useState(0);
  const [previewRows,      setPreviewRows]      = useState<string[][] | null>(null);
  const [extracting,     setExtracting]     = useState(false);
  const [headerError,    setHeaderError]    = useState("");
  const [tableHtml,      setTableHtml]      = useState("");
  const [loading,        setLoading]        = useState(false);
  const [chunkProgress,  setChunkProgress]  = useState<{ done: number; total: number } | null>(null);
  const [error,          setError]          = useState("");
  const [copied,         setCopied]         = useState(false);
  const [cleanCount,     setCleanCount]     = useState(0);
  const [lastClean,      setLastClean]      = useState<string | null>(null);
  const resultRef    = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModeChange = (mode: InputMode) => { setInputMode(mode); setError(""); };

  const resetFileState = () => {
    setFile(null);
    setRawRows(null);
    setHeaderInput("1");
    setHeaderConfirmed(false);
    setConfirmedText("");
    setConfirmedRowCount(0);
    setPreviewRows(null);
    setHeaderError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    resetFileState();
    setFile(f);
    setExtracting(true);
    setError("");
    try {
      const rows = await parseFileToRows(f);
      if (rows.length === 0) throw new Error("파일에서 데이터를 추출할 수 없습니다.");
      setRawRows(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일 처리 중 오류가 발생했습니다.");
      setFile(null);
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirmHeader = () => {
    if (!rawRows) return;
    setHeaderError("");
    const num = parseInt(headerInput, 10);
    if (!Number.isFinite(num) || num < 1) {
      setHeaderError("1 이상의 숫자를 입력하세요.");
      return;
    }
    try {
      const { previewRows: pRows, confirmedText: cText, rowCount } = applyHeaderRow(rawRows, num);
      setConfirmedText(cText);
      setConfirmedRowCount(rowCount);
      setPreviewRows(pRows);
      setHeaderConfirmed(true);
    } catch (e) {
      setHeaderError(e instanceof Error ? e.message : "헤더 행 지정 중 오류가 발생했습니다.");
    }
  };

  const handleHeaderInputChange = (v: string) => {
    setHeaderInput(v);
    setHeaderConfirmed(false);
    setPreviewRows(null);
    setHeaderError("");
  };

  useEffect(() => {
    const count = localStorage.getItem(CLEAN_COUNT_KEY);
    if (count) setCleanCount(parseInt(count, 10) || 0);
    setLastClean(localStorage.getItem(LAST_CLEAN_KEY));
  }, []);

  const sourceText = inputMode === "text" ? input : confirmedText;

  const handleClean = async () => {
    if (!sourceText.trim()) return;
    setError("");
    setTableHtml("");

    // 파일 업로드 탭: AI 없이 HTML 직접 사용
    if (inputMode === "file") {
      setTableHtml(confirmedText);
      trackUsage("data");
      const now = new Date().toISOString();
      localStorage.setItem(LAST_CLEAN_KEY, now);
      setLastClean(now);
      setCleanCount((prev) => {
        const next = prev + 1;
        localStorage.setItem(CLEAN_COUNT_KEY, String(next));
        return next;
      });
      return;
    }

    // 텍스트 입력 탭: AI 처리
    setLoading(true);
    setChunkProgress(null);
    try {
      const result = await cleanDataWithChunks(sourceText, (done, total) => {
        setChunkProgress({ done, total });
      });
      setTableHtml(result);
      trackUsage("data");
      const now = new Date().toISOString();
      localStorage.setItem(LAST_CLEAN_KEY, now);
      setLastClean(now);
      setCleanCount((prev) => {
        const next = prev + 1;
        localStorage.setItem(CLEAN_COUNT_KEY, String(next));
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 정리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setChunkProgress(null);
    }
  };

  const handleCopy = async () => {
    if (!tableHtml) return;
    await navigator.clipboard.writeText(tableHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCSV = () => {
    if (!tableHtml) return;
    const csv  = tableHtmlToCSV(tableHtml);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "worky_data.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const canClean = inputMode === "text"
    ? !!input.trim()
    : headerConfirmed && !!confirmedText.trim();

  return (
    <div className="space-y-3 max-w-4xl mx-auto w-full">
      {/* Bento 통계 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">누적 정리 건수</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{cleanCount}건</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">마지막 정리</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{formatLastClean(lastClean)}</p>
        </div>
      </div>

      {/* 입력 탭 */}
      <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-1.5 shadow-sm grid grid-cols-2 gap-1 shrink-0">
        {([
          { id: "text" as InputMode, label: "텍스트 입력", Icon: IconAlignLeft },
          { id: "file" as InputMode, label: "파일 업로드", Icon: IconFileUpload },
        ]).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => handleModeChange(id)}
            className={[
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors",
              inputMode === id
                ? "bg-[#6C63FF] text-white shadow-sm"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700",
            ].join(" ")}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
        {inputMode === "text" ? (
          <>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
              원본 데이터 입력
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"이름 나이 부서\n홍길동 28 개발팀\n김철수 32 마케팅\n이영희 25 디자인"}
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
          </>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
              CSV 또는 Excel 파일 업로드
            </label>

            {/* 파일 선택 영역 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting}
              className={[
                "w-full flex flex-col items-center justify-center gap-3 min-h-[140px] rounded-xl border-2 border-dashed transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                file
                  ? "border-[#6C63FF]/50 bg-[#6C63FF]/5 hover:border-[#6C63FF]/70"
                  : "border-slate-300 dark:border-zinc-600 hover:border-[#6C63FF]/60 hover:bg-[#6C63FF]/5",
              ].join(" ")}
            >
              <IconFileUpload className={`w-8 h-8 ${file ? "text-[#6C63FF]" : "text-slate-400 dark:text-zinc-500"}`} />
              <div className="text-center px-4">
                <p className={`text-sm font-medium ${file ? "text-[#6C63FF]" : "text-slate-600 dark:text-zinc-400"}`}>
                  {file ? file.name : "클릭해서 파일 선택"}
                </p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                  {file ? "클릭해서 파일 교체" : "CSV, Excel(.xlsx, .xls) 지원"}
                </p>
              </div>
            </button>
            <input
              ref={fileInputRef} type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange} className="hidden"
            />

            {/* 추출 중 */}
            {extracting && (
              <div className="flex items-center gap-2 mt-3 text-sm text-slate-500 dark:text-zinc-400">
                <span className="w-4 h-4 border-2 border-slate-300 border-t-[#6C63FF] rounded-full animate-spin shrink-0" />
                데이터 추출 중...
              </div>
            )}

            {/* 헤더 행 지정 */}
            {rawRows && !extracting && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400 shrink-0">
                    헤더(컬럼명)가 몇 번째 행에 있나요?
                  </label>
                  <input
                    type="number" min="1" max={rawRows.length}
                    value={headerInput}
                    onChange={(e) => handleHeaderInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirmHeader()}
                    className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 text-center focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                  />
                  <button
                    onClick={handleConfirmHeader}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition"
                    style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
                  >
                    확인
                  </button>
                  <span className="text-xs text-slate-400 dark:text-zinc-500">
                    전체 {rawRows.length}행
                  </span>
                </div>

                {headerError && (
                  <p className="text-xs text-red-500">{headerError}</p>
                )}

                {/* 미리보기 */}
                {previewRows && headerConfirmed && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                      미리보기 (헤더 + 최대 3행)
                    </p>
                    <PreviewTable rows={previewRows} />
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">
                      총 {confirmedRowCount}개 데이터 행 · 헤더 행 번호가 잘못됐으면 다시 입력하세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end mt-3">
          <button
            onClick={handleClean}
            disabled={loading || !canClean || extracting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {chunkProgress && chunkProgress.total > 1
                  ? `정리 중... (${chunkProgress.done}/${chunkProgress.total})`
                  : "정리 중..."}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                </svg>
                {inputMode === "file" ? "정리하기" : "AI로 정리하기"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* 결과 */}
      {tableHtml && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">정리된 표</h2>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? "복사됨!" : "HTML 복사"}
              </button>
              <button onClick={handleDownloadCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition"
                style={{ background: "var(--primary)" }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV 다운로드
              </button>
            </div>
          </div>
          <EditableResult value={tableHtml} onChange={setTableHtml} rows={14} textareaClassName="font-mono text-xs">
            <div
              ref={resultRef}
              className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700 [&_table]:w-full [&_table]:text-sm [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-white [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-slate-700 dark:[&_td]:text-zinc-300 [&_tr:nth-child(even)_td]:bg-slate-50 dark:[&_tr:nth-child(even)_td]:bg-zinc-800/50"
            >
              <style>{`
                table { border-collapse: collapse; }
                th { background: #6C63FF; }
                td { border-bottom: 1px solid #e2e8f0; }
                @media (prefers-color-scheme: dark) {
                  td { border-bottom: 1px solid #3f3f46; }
                }
              `}</style>
              <div dangerouslySetInnerHTML={{ __html: tableHtml }} />
            </div>
          </EditableResult>
        </div>
      )}
      <HelpButton
        title="데이터 정리 사용법"
        steps={[
          { step: "데이터 입력", desc: "CSV·표·자유형식 텍스트를 붙여넣거나 파일을 업로드하세요." },
          { step: "헤더 행 지정", desc: "파일 업로드 후 컬럼명이 있는 행 번호를 입력하고 확인을 누르세요." },
          { step: "AI 분석", desc: "미리보기 확인 후 AI로 정리하기 버튼을 클릭하세요." },
          { step: "내보내기", desc: "HTML 복사 또는 CSV 파일로 다운로드하세요." },
        ]}
      />
    </div>
  );
}
