"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Components } from "react-markdown";
import type { Root, RootContent } from "mdast";

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
// "어떤 범위가 코드 블록인가"를 정규식으로 나열하는 대신(fenced ```/~~~,
// 4-backtick, 들여쓰기 등 형태를 하나씩 추가하다 계속 놓치는 경우가
// 나왔음 - Codex 리뷰에서 반복 지적됨) remark-parse로 실제 파싱해 얻은
// code 노드들의 위치(offset) 범위를 구하고, 그 범위 밖에서만 치환한다 -
// "코드 블록인지" 판단 자체를 정규식이 아니라 실제 마크다운 파서에
// 위임하므로 어떤 코드 블록 문법이 와도 항상 정확하다.
function findCodeRanges(text: string): Array<[number, number]> {
  const tree = unified().use(remarkParse).parse(text) as Root;
  const ranges: Array<[number, number]> = [];
  const walk = (node: RootContent | Root) => {
    if (node.type === "code") {
      if (node.position) {
        ranges.push([node.position.start.offset ?? 0, node.position.end.offset ?? 0]);
      }
      return; // code 노드는 자식이 없으므로 더 내려갈 필요 없음
    }
    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) walk(child as RootContent);
    }
  };
  walk(tree);
  return ranges;
}

// 코드 범위 판정은 정규화 전 "원본" 텍스트 기준이다. 치환 후 "•"가 "-"로
// 바뀌면 그 줄이 진짜 리스트 항목이 되므로, 그 뒤에 들여쓰기 코드 블록이
// 바로 이어지는 경우 CommonMark의 리스트 연속 규칙상 별도 코드 블록이
// 아니라 리스트 항목의 연속 문단으로 파싱될 수 있다 - 이는 CommonMark
// 자체의 리스트/코드블록 인접 규칙이고(사람이 직접 "-"로 쓴 리스트에도
// 동일하게 적용됨), 이 함수가 지키려는 것(코드 블록 "안의 텍스트 내용"이
// 뒤바뀌지 않는 것)과는 별개 - 실제로 원본 코드 텍스트 자체는 그대로
// 보존된다.
//
// 코드 범위와의 겹침은 "점(point) 포함"이 아니라 "구간 겹침(overlap)"으로
// 판정한다. 리스트 항목 안에 들여쓰기 코드 블록이 중첩된 경우(예:
// "- item\n\n      • literal"), remark가 계산하는 code 노드의 시작
// offset이 물리적 줄 시작이 아니라 "리스트 자체의 들여쓰기만 제외한"
// 위치를 가리켜 정규식 매치의 줄-시작 offset보다 뒤에 오는 경우가 있다
// (Codex 지적, Issue #71 - 실측: "      • literal"에서 code 노드
// start.offset=10인데 매치 시작 offset은 8이라 point 비교(offset >= start)가
// 거짓이 되어 코드 "밖"으로 오판됨). 매치가 차지하는 구간
// [matchStart, matchEnd)와 코드 구간 [start, end)이 조금이라도 겹치면
// 코드로 취급하도록 바꾸면, 컨테이너(리스트 등)에 따라 remark가 code
// 노드의 시작 offset을 정확히 어디로 잡는지와 무관하게 항상 안전하다 -
// 정규식이 매치한 줄 전체가 어차피 코드 블록의 물리적 범위 안에 있으므로
// 두 구간은 반드시 겹친다.
function normalizeBulletMarkers(text: string): string {
  const codeRanges = findCodeRanges(text);
  return text.replace(/^([ \t]*)[•‣▪] /gm, (match, indent: string, offset: number) => {
    const matchStart = offset;
    const matchEnd = offset + match.length;
    const overlapsCode = codeRanges.some(([start, end]) => matchStart < end && matchEnd > start);
    return overlapsCode ? match : `${indent}- `;
  });
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
