import { describe, expect, it, vi } from "vitest";
import { upsertSettings } from "./settings";

const { upsert, from } = vi.hoisted(() => ({ upsert: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));

describe("settings save result", () => {
  it("preserves the existing table, conflict key and patch", async () => {
    from.mockReturnValue({ upsert });
    upsert.mockResolvedValue({ error: null });
    await upsertSettings("test-user", { menu_order: ["/data", "/summary"] });
    expect(from).toHaveBeenCalledWith("user_settings");
    expect(upsert).toHaveBeenLastCalledWith({ user_id: "test-user", menu_order: ["/data", "/summary"] }, { onConflict: "user_id" });
  });
  it("rejects a failed response so the UI cannot claim it was saved", async () => {
    from.mockReturnValue({ upsert });
    const error = { message: "simulated save rejection" };
    upsert.mockResolvedValue({ error });
    await expect(upsertSettings("test-user", { help_button: false })).rejects.toBe(error);
  });
});
