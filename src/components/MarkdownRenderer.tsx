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

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className ?? "space-y-0.5"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
