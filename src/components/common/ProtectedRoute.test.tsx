import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

const auth = vi.hoisted(() => ({ state: { token: null as string | null, loading: false, discardLegacyRedirect: false } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.state }));
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/admin/users/54062570162229330/1" }),
  Navigate: ({ to }: { to: string }) => React.createElement("span", { "data-target": to }),
  Outlet: () => React.createElement("span", null, "authenticated"),
}));

beforeEach(() => { auth.state = { token: null, loading: false, discardLegacyRedirect: false }; });
describe("protected route cache migration", () => {
  it("does not replay a rounded detail URL after invalidating a legacy session", () => {
    auth.state.discardLegacyRedirect = true;
    expect(renderToStaticMarkup(React.createElement(ProtectedRoute))).toBe('<span data-target="/login"></span>');
  });
  it("preserves normal unauthenticated deep-link redirects", () => {
    expect(renderToStaticMarkup(React.createElement(ProtectedRoute))).toContain("/login?redirect=%2Fadmin%2Fusers%2F54062570162229330%2F1");
  });
  it("renders authenticated routes normally", () => {
    auth.state.token = "fixture-token";
    expect(renderToStaticMarkup(React.createElement(ProtectedRoute))).toBe("<span>authenticated</span>");
  });
});
