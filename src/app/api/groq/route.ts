import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  messages:    Message[];
  systemPrompt?: string;
  max_completion_tokens?: number;
  model?: string;
  stream?: boolean;
}

const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

// reasoning_effort는 openai/gpt-oss-120b, openai/gpt-oss-20b에서만 지원되는
// 파라미터(groq-sdk 타입 정의 기준). 다른 모델(QnA의 judge 호출 등)에 그대로
// 보내면 에러가 날 수 있어, 실측 확인된 이 두 모델일 때만 조건부로 넣는다.
// 모델 비교 실측(4개 모델 x 4개 카테고리) 결과 gpt-oss-120b 단일 모델 +
// reasoning_effort:"low" 조합이 가장 안정적이라 전역 기본값으로 채택했다.
const REASONING_EFFORT_LOW_MODELS = new Set(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);

const KOREAN_RULES = `

You must respond ONLY in Korean (한국어). Do not use any Chinese characters (한자), Japanese, Russian, Greek, or any other language mixed in. Use pure, natural modern Korean only.
한국어 작성 규칙 (반드시 준수):
- 반드시 순수 한국어로만 작성
- 한자, 영어, 일본어, 러시아어 등 모든 외국어 혼용 절대 금지
- 고유명사나 브랜드명은 한국어 표기 사용
- 자연스러운 현대 한국어 비즈니스 문체 사용`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const body: RequestBody = await req.json();
    const { messages, systemPrompt, max_completion_tokens, model, stream } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages 필드가 필요합니다." },
        { status: 400 }
      );
    }

    const fullMessages: Message[] = systemPrompt
      ? [{ role: "system", content: systemPrompt + KOREAN_RULES }, ...messages]
      : messages;

    const resolvedModel = model ?? DEFAULT_GROQ_MODEL;
    const reasoningEffort = REASONING_EFFORT_LOW_MODELS.has(resolvedModel)
      ? ({ reasoning_effort: "low" as const })
      : {};

    if (stream === true) {
      const completionStream = await groq.chat.completions.create({
        model: resolvedModel,
        messages: fullMessages,
        stream: true,
        ...(max_completion_tokens ? { max_completion_tokens } : {}),
        ...reasoningEffort,
      });
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of completionStream) {
              const delta = chunk.choices[0]?.delta?.content || "";
              if (delta) controller.enqueue(encoder.encode(delta));
            }
          } catch (e) {
            console.error("스트리밍 오류:", e);
          } finally {
            controller.close();
          }
        },
      });
      return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    const completion = await groq.chat.completions.create({
      model: resolvedModel,
      messages: fullMessages,
      ...(max_completion_tokens ? { max_completion_tokens } : {}),
      ...reasoningEffort,
    });

    const result = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Groq API 오류:", error);

    if (error instanceof Groq.APIError && (error.status === 429 || error.status === 413)) {
      return NextResponse.json(
        { error: "일시적으로 요청이 많습니다. 잠시 후 다시 시도해주세요.", code: "rate_limit" },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
