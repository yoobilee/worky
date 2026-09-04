import { describe, expect, it } from "vitest";

import { normalizeBulletMarkers } from "./markdown";

describe("normalizeBulletMarkers", () => {
  it("일반 텍스트 영역의 불릿을 CommonMark 목록 마커로 정규화한다", () => {
    const markdown = "• 첫 번째 항목\n• 두 번째 항목";

    expect(normalizeBulletMarkers(markdown)).toBe("- 첫 번째 항목\n- 두 번째 항목");
  });

  it("fenced code block 내부의 불릿과 코드 내용을 원문 그대로 보존한다", () => {
    const markdown = [
      "• 코드 밖 항목",
      "",
      "```txt",
      "• 코드 안의 불릿",
      'const marker = "•";',
      "```",
      "",
      "• 코드 뒤 항목",
    ].join("\n");

    const expected = [
      "- 코드 밖 항목",
      "",
      "```txt",
      "• 코드 안의 불릿",
      'const marker = "•";',
      "```",
      "",
      "- 코드 뒤 항목",
    ].join("\n");

    expect(normalizeBulletMarkers(markdown)).toBe(expected);
  });
});
