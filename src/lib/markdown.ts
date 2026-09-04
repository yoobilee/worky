import type { Root, RootContent } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";

function findCodeRanges(text: string): Array<[number, number]> {
  const tree = unified().use(remarkParse).parse(text) as Root;
  const ranges: Array<[number, number]> = [];

  const walk = (node: RootContent | Root) => {
    if (node.type === "code") {
      if (node.position) {
        ranges.push([node.position.start.offset ?? 0, node.position.end.offset ?? 0]);
      }
      return;
    }

    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) walk(child as RootContent);
    }
  };

  walk(tree);
  return ranges;
}

/**
 * CommonMark가 목록으로 인식하지 않는 불릿 문자를 목록 마커로 바꾼다.
 * 실제 Markdown AST의 code 범위와 겹치는 내용은 원문 그대로 보존한다.
 */
export function normalizeBulletMarkers(text: string): string {
  const codeRanges = findCodeRanges(text);

  return text.replace(/^([ \t]*)[•‣▪] /gm, (match, indent: string, offset: number) => {
    const matchStart = offset;
    const matchEnd = offset + match.length;
    const overlapsCode = codeRanges.some(([start, end]) => matchStart < end && matchEnd > start);

    return overlapsCode ? match : `${indent}- `;
  });
}
