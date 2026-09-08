import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QueryStatus, type QueryStatusProps } from "./QueryStatus";

const defaults: QueryStatusProps = {
  isFetching: false,
  isError: false,
  error: null,
  dataUpdatedAt: 0,
  hasData: false,
  onRefresh: () => {},
};

function render(overrides: Partial<QueryStatusProps> = {}) {
  return renderToStaticMarkup(<QueryStatus {...defaults} {...overrides} />);
}

describe("query feedback", () => {
  it("does not invent a successful update before data arrives", () => {
    expect(render()).toContain("尚未成功加载");
    expect(render()).not.toContain("数据加载失败");
  });

  it("distinguishes initial failure from a successful empty result", () => {
    expect(render({ isError: true, error: new Error("请求失败") })).toContain("数据加载失败，请重试");
    expect(render({ hasData: true, dataUpdatedAt: 1 })).not.toContain("数据加载失败");
  });

  it("marks cached data as stale after a failed refresh", () => {
    const markup = render({ isError: true, hasData: true, dataUpdatedAt: 1 });
    expect(markup).toContain("刷新失败，当前保留上次成功加载的数据");
    expect(markup).not.toContain("尚未成功加载");
  });

  it("escapes server errors instead of rendering them as HTML", () => {
    const markup = render({ isError: true, error: new Error("<script>alert(1)</script>") });
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("&lt;script&gt;");
  });
});
