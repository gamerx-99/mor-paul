// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useIsMobile } from "./useMobile";

function MobileProbe() {
  return createElement("span", null, useIsMobile() ? "mobile" : "desktop");
}

describe("useIsMobile", () => {
  it("uses the current viewport during the first render instead of waiting for an effect", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    expect(renderToStaticMarkup(createElement(MobileProbe))).toContain("mobile");
  });
});
