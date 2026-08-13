import { readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const entry = new URL("./supabase-entry.js", import.meta.url);
const outfile = new URL("../../assets/js/vendor/supabase.js", import.meta.url);

await build({
  entryPoints: [entry.pathname],
  outfile: outfile.pathname,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "none",
  logLevel: "info"
});

const bundled = await readFile(outfile, "utf8");
await writeFile(outfile, bundled.replace(/[ \t]+$/gm, ""));
