import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "ao-command-web");
const dist = path.join(root, "dist");
const server = path.join(dist, "server");
const meta = path.join(dist, ".openai");

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(server, { recursive: true });
await fs.mkdir(meta, { recursive: true });

const files = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
  "/app.js": { file: "app.js", type: "application/javascript; charset=utf-8" },
  "/config.js": { file: "config.js", type: "application/javascript; charset=utf-8" }
};

const assets = {};
const indexHtml = await fs.readFile(path.join(src, "index.html"), "utf8");
for (const [route, info] of Object.entries(files)) {
  assets[route] = {
    body: info.file === "index.html" ? indexHtml : await fs.readFile(path.join(src, info.file), "utf8"),
    type: info.type
  };
  if (route !== "/") {
    await fs.copyFile(path.join(src, info.file), path.join(dist, info.file));
  }
}

const memberRoutes = ["member", "profile", "balance", "payments", "attendance", "tasks", "calendar", "announcements"];
for (const route of memberRoutes) {
  const folder = route === "member" ? path.join(dist, "member") : path.join(dist, "member", route);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, "index.html"), indexHtml);
}

await fs.copyFile(path.join(root, ".openai", "hosting.json"), path.join(meta, "hosting.json"));

const worker = `const assets = ${JSON.stringify(assets)};\n\nfunction responseFor(pathname) {\n  const asset = assets[pathname] || assets[\"/\"];\n  return new Response(asset.body, {\n    headers: {\n      \"content-type\": asset.type,\n      \"cache-control\": pathname === \"/\" || pathname === \"/index.html\" ? \"no-store\" : \"public, max-age=300\"\n    }\n  });\n}\n\nexport default {\n  async fetch(request) {\n    const url = new URL(request.url);\n    return responseFor(url.pathname);\n  }\n};\n`;

await fs.writeFile(path.join(server, "index.js"), worker);
console.log("Built AO Command artifact in dist/");
