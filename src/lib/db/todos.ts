import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import type { Json } from "@/types/supabase";

type DbTodosRow = Database["public"]["Tables"]["todos"]["Row"];

export interface TodoItem {
  id:           string;
  text:         string;
  completed:    boolean;
  createdAt:    number;
  carriedOver?: boolean;
  originalDate?: string;
  originalId?:  string;
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

export async function getRowsByOriginalId(
  userId: string,
  originalId: string
): Promise<{ date: string; todos: TodoItem[] }[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("todos")
    .select("date, todos")
    .eq("user_id", userId);
  const rows = (data ?? []) as { date: string; todos: TodoItem[] }[];
  return rows.filter((row) => row.todos.some((t) => t.originalId === originalId));
}

export async function updateTodoInRow(
  userId: string,
  date: string,
  todoId: string,
  completed: boolean
): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase
    .from("todos")
    .select("todos")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (!data) return;
  const updated = (data.todos as TodoItem[]).map((t) =>
    t.id === todoId ? { ...t, completed } : t
  );
  await upsertTodos(userId, date, updated);
}

export async function upsertTodos(userId: string, date: string, todos: TodoItem[]): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("todos")
    .upsert(
      { user_id: userId, date, todos: todos as unknown as Json },
      { onConflict: "user_id,date" }
    );
}
