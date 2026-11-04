import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import {
  defaults,
  settingsSchema,
  safeLink,
  mediaPaths,
  parseSettings,
  contrastText,
  validateImageBytes,
} from "./settings";
describe("System Management safety", () => {
  test("validates image signatures and enforces the five MB limit", () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(validateImageBytes(png, "png", 5 * 1024 * 1024), true);
    assert.equal(validateImageBytes(png, "png", 5 * 1024 * 1024 + 1), false);
    assert.equal(validateImageBytes(new Uint8Array([60, 115, 118, 103]), "png", 100), false);
    assert.equal(validateImageBytes(png, "svg", 100), false);
  });
  test("rejects executable and external protocol-relative CTA destinations", () => {
    for (const url of ["javascript:alert(1)", "//evil.test", "/\\evil.test", "data:text/html,a"])
      assert.equal(safeLink.safeParse(url).success, false);
    assert.equal(safeLink.safeParse("/auth").success, true);
  });
  test("only referenced logo favicon and landing images are eligible for public delivery", () => {
    const s = structuredClone(defaults);
    s.brand.logo = "abc.png";
    s.brand.favicon = "def.ico";
    s.landing.image = "ghi.jpg";
    assert.deepEqual(mediaPaths(s), ["abc.png", "def.ico", "ghi.jpg"]);
    assert.equal(mediaPaths(s).includes("draft.png"), false);
  });
  test("rejects SVG and file paths in media settings", () => {
    const s = structuredClone(defaults);
    s.brand.logo = "image.svg";
    assert.equal(settingsSchema.safeParse(s).success, false);
    s.brand.logo = "../private.png";
    assert.equal(settingsSchema.safeParse(s).success, false);
  });
  test("supports private draft changes without changing defaults", () => {
    const draft = structuredClone(defaults);
    draft.landing.heading = "New heading";
    assert.equal(defaults.landing.heading, "Attendra");
    assert.equal(settingsSchema.parse(draft).landing.heading, "New heading");
  });
  test("missing settings preserve the current website", () =>
    assert.equal(parseSettings(null).footer.copyright, "© {year} {name}."));
  test("theme colours select readable foregrounds", () => {
    assert.equal(contrastText("#ffffff"), "oklch(0.15 0 0)");
    assert.equal(contrastText("#000000"), "oklch(0.99 0 0)");
  });
});
