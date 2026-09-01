"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/*
 * QnA/DocSummary/TemplateGen이 각자 들고 있던 수제 마크다운 파서를
 * 대체하는 공용 컴포넌트. GFM(표, 취소선, 체크박스 리스트, 자동링크)을
 * 지원하며, 기존 파서가 쓰던 스타일(text-sm, slate/zinc 팔레트, 다크모드)을
 * 최대한 그대로 재현한다.
 *
 * rehype-raw 등 원본 HTML을 파싱하는 플러그인은 의도적으로 추가하지 않는다 -
 * react-markdown은 기본적으로 마크다운 텍스트 안의 raw HTML을 렌더링하지
 * 않고 그대로 이스케이프해 보여주므로(AI 응답에 <script> 등이 섞여도
 * 실행되지 않음), XSS 위험 없이 안전하다.
 */

const components: Components = {
  h1: ({ children }) => (
    <p className="text-[15px] font-bold text-slate-900 dark:text-zinc-50 mt-3 mb-1">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="text-[15px] font-bold text-slate-900 dark:text-zinc-50 mt-3 mb-1">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 mt-2 mb-0.5">{children}</p>
  ),
  h4: ({ children }) => (
    <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 mt-2 mb-0.5">{children}</p>
  ),
  h5: ({ children }) => (
    <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 mt-2 mb-0.5">{children}</p>
  ),
  h6: ({ children }) => (
    <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 mt-2 mb-0.5">{children}</p>
  ),
  p: ({ children }) => (
    <p className="text-sm text-slate-800 dark:text-zinc-100 leading-relaxed my-1">{children}</p>
  ),
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-0.5 my-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-0.5 my-1">{children}</ol>,
  li: ({ children }) => (
    <li className="text-sm text-slate-800 dark:text-zinc-100 leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-slate-900 dark:text-zinc-50">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => (
    <del className="line-through text-slate-500 dark:text-zinc-400">{children}</del>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#4D44CC] dark:text-[#8B85FF] underline underline-offset-2"
    >
      {children}
    </a>
  ),
  input: ({ checked, disabled: _disabled, ...props }) => (
    <input
      {...props}
      type="checkbox"
      checked={checked ?? false}
      disabled
      readOnly
      className="mr-1.5 align-middle accent-[#6C63FF]"
    />
  ),
  code: ({ children, className }) => (
    <code
      className={`${className ?? ""} font-mono text-[13px] px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100`}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-1.5 p-3 rounded-lg bg-slate-100 dark:bg-zinc-800 overflow-x-auto text-[13px] font-mono">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-2 border-slate-200 dark:border-zinc-700" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-100 dark:bg-zinc-800">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-slate-200 dark:border-zinc-700 last:border-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-slate-800 dark:text-zinc-100 align-top">{children}</td>
  ),
};

// "• "로 시작하는 줄을 CommonMark/GFM이 인식하는 "- " 불릿 마커로 정규화한다.
// DocSummary의 "요점 정리" 스타일은 시스템 프롬프트에서 각 항목이 "• "로
// 시작하도록 명시적으로 요청하는데(DocSummary.tsx), "•"는 CommonMark/GFM
// 리스트 마커가 아니라서 remark-gfm이 이를 리스트로 인식하지 못하고 연속된
// 항목들이 하나의 문단으로 뭉쳐버린다 - 기존 수제 파서는 "•"를 직접
// 처리했었지만 react-markdown으로 교체하며 사라진 동작이라 여기서 보정한다.
//
// 코드 펜스(```...```) 내부는 건드리지 않는다 - AI 응답에 코드 블록이
// 포함되어 있고 그 안에 "• "로 시작하는 줄이 있으면(예: 다른 언어의 주석,
// 문서 인용 등) 마크다운 파싱 전에 이 정규식이 무차별적으로 원본 코드를
// 고쳐 써버려 화면에 표시/복사되는 내용이 실제 모델 출력과 달라지는
// 문제가 있었다(Codex 리뷰 지적).
function normalizeBulletMarkers(text: string): string {
  const segments = text.split(/(```[\s\S]*?```)/g);
  return segments
    .map((segment, i) =>
      i % 2 === 1
        ? segment // 홀수 인덱스는 캡처된 ```...``` 코드 펜스 - 원본 그대로 둔다
        : segment.replace(/^([ \t]*)[•‣▪] /gm, "$1- ")
    )
    .join("");
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className ?? "space-y-0.5"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalizeBulletMarkers(content)}
      </ReactMarkdown>
    </div>
  );
}
