import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
test("insertion lines stay centered in fixed gaps without changing layout or receiving touches", async () => {
  const result = await build({
    entryPoints: ["src/InsertionIndicator.tsx"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: ["react"],
    plugins: [
      {
        name: "native",
        setup(b) {
          b.onResolve({ filter: /^react-native$/ }, () => ({
            path: "native",
            namespace: "mock",
          }));
          b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
            contents: `export const View="View";`,
          }));
        },
      },
    ],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    require,
    mod,
    mod.exports,
  );
  for (const axis of ["horizontal", "vertical"]) {
    for (const edge of ["before", "after"]) {
      const element = mod.exports.InsertionIndicator({
        axis,
        edge,
        color: "#123456",
      });
      const { style, pointerEvents, accessible } = element.props;
      assert.equal(style.position, "absolute");
      assert.equal(pointerEvents, "none");
      assert.equal(accessible, false);
      assert.equal(style.backgroundColor, "#123456");
      const horizontal = axis === "horizontal";
      const side = horizontal
        ? edge === "before"
          ? "left"
          : "right"
        : edge === "before"
          ? "top"
          : "bottom";
      const thickness = horizontal ? style.width : style.height;
      const gap = horizontal ? 16 : 8;
      assert.equal(style[side] + thickness / 2, -gap / 2);
      assert.ok(-style[side] > thickness); // space on either side, not attached to a border
    }
  }
});
