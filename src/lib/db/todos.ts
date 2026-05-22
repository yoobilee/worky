import { createClient } from "@/lib/supabase/client";

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  carriedOver?: boolean;
  originalDate?: string;
  originalId?: string;
}

export async function getTodos(userId: string, date: string): Promise<TodoItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("todos")
    .select("todos")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  return (data?.todos as TodoItem[]) ?? [];
}

export async function getPastTodoRows(
  userId: string,
  beforeDate: string
): Promise<{ date: string; todos: TodoItem[] }[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("todos")
    .select("date, todos")
    .eq("user_id", userId)
    .lt("date", beforeDate);
  return (data ?? []) as { date: string; todos: TodoItem[] }[];
}

export async function upsertTodos(userId: string, date: string, todos: TodoItem[]): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("todos")
    .upsert({ user_id: userId, date, todos }, { onConflict: "user_id,date" });
}
