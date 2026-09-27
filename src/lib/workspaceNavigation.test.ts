import { describe, expect, it } from "vitest";
import { workspaceRoutes } from "./workspaceNavigation";
import { ALWAYS_VISIBLE_ITEMS, OPTIONAL_MENU_ITEMS } from "./menuSettings";

describe("workspace navigation compatibility", () => {
  it("keeps fixed features and the stored optional order while hiding disabled tools", () => {
    const routes = workspaceRoutes({ "/data": false, "/summary": true }, ["/data", "/summary", "/template"]);
    expect(routes.slice(0, 6)).toEqual(ALWAYS_VISIBLE_ITEMS.map(item => item.href));
    expect(routes.slice(6, 8)).toEqual(["/summary", "/template"]);
    expect(routes).not.toContain("/data");
  });
  it("retains newly introduced optional tools and rejects unknown or repeated routes", () => {
    const routes = workspaceRoutes({}, ["/summary", "/summary", "/missing"]);
    expect(routes.filter(route => route === "/summary")).toHaveLength(1);
    expect(routes).not.toContain("/missing");
    for (const item of OPTIONAL_MENU_ITEMS) expect(routes).toContain(item.href);
  });
  it("keeps mandatory routes enabled even with stale settings", () => {
    const settings = Object.fromEntries([...OPTIONAL_MENU_ITEMS, ...ALWAYS_VISIBLE_ITEMS].map(item => [item.href, false]));
    expect(workspaceRoutes(settings, [])).toEqual(ALWAYS_VISIBLE_ITEMS.map(item => item.href));
  });
});
