import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  messages:    Message[];
  systemPrompt?: string;
  max_tokens?: number;
  model?: string;
}

const KOREAN_RULES = `

You must respond ONLY in Korean (한국어). Do not use any Chinese characters (한자), Japanese, Russian, Greek, or any other language mixed in. Use pure, natural modern Korean only.
한국어 작성 규칙 (반드시 준수):
- 반드시 순수 한국어로만 작성
- 한자, 영어, 일본어, 러시아어 등 모든 외국어 혼용 절대 금지
- 고유명사나 브랜드명은 한국어 표기 사용
- 자연스러운 현대 한국어 비즈니스 문체 사용`;

export async function POST(req: NextRequest) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const body: RequestBody = await req.json();
    const { messages, systemPrompt, max_tokens, model } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages 필드가 필요합니다." },
        { status: 400 }
      );
    }

    const fullMessages: Message[] = systemPrompt
      ? [{ role: "system", content: systemPrompt + KOREAN_RULES }, ...messages]
      : messages;

    const completion = await groq.chat.completions.create({
      model: model ?? "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: fullMessages,
      ...(max_tokens ? { max_tokens } : {}),
    });

    const result = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Groq API 오류:", error);
    return NextResponse.json(
      { error: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
