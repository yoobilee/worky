import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: createClientMock,
}));

import { deleteEvent, getEvents, updateEvent } from "./calendar";

function mockMutationResult(result: { data: unknown; error: unknown }) {
  const query = {
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.update.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  createClientMock.mockReturnValue({
    from: vi.fn().mockReturnValue(query),
  });
  return query;
}

function mockReadResult(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  createClientMock.mockReturnValue({
    from: vi.fn().mockReturnValue(query),
  });
  return query;
}

describe("calendar event mutations", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("수정 요청의 Supabase 오류를 호출부로 전달한다", async () => {
    const databaseError = { message: "forced update failure" };
    mockMutationResult({ data: null, error: databaseError });

    await expect(
      updateEvent("user-1", "event-1", { title: "수정" }),
    ).rejects.toBe(databaseError);
  });

  it("RLS 등으로 수정된 행이 0건이면 실패한다", async () => {
    mockMutationResult({ data: null, error: null });

    await expect(
      updateEvent("user-1", "event-1", { title: "수정" }),
    ).rejects.toThrow("Calendar event update affected no rows.");
  });

  it("삭제 요청의 Supabase 오류를 호출부로 전달한다", async () => {
    const databaseError = { message: "forced delete failure" };
    mockMutationResult({ data: null, error: databaseError });

    await expect(deleteEvent("user-1", "event-1")).rejects.toBe(databaseError);
  });

  it("RLS 등으로 삭제된 행이 0건이면 실패한다", async () => {
    const query = mockMutationResult({ data: null, error: null });

    await expect(deleteEvent("user-1", "event-1")).rejects.toThrow(
      "Calendar event delete affected no rows.",
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "event-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "user_id", "user-1");
  });
});

describe("calendar event reads", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("does not include the owner ID in returned calendar data", async () => {
    const query = mockReadResult({ data: [], error: null });

    await getEvents("user-1");

    expect(query.select).toHaveBeenCalledWith(
      "id, date, title, time, location, location_url, description, recurrence_group_id",
    );
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
