import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(host = "localhost") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://${host}/`, { headers: { accept: "text/html", host } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Blue Current operations dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>WaveWatch Operations V2 \| Blue Current<\/title>/i,
  );
  assert.match(html, /Operations Base/i);
  assert.match(html, /favicon\.svg/);
  const loopbackHtml = await (await render("127.0.0.1:3001")).text();
  assert.match(loopbackHtml, /http:\/\/127\.0\.0\.1:3001\/favicon\.svg/);
  assert.doesNotMatch(loopbackHtml, /https:\/\/127\.0\.0\.1:3001/);
  assert.equal((html.match(/class="rotation-card /g) ?? []).length, 17);
  assert.match(html, /Start simulation/);
  assert.match(html, /7:30 AM/);
  assert.match(html, /Current Cove/i);
  assert.match(html, /Tidal Bay/i);
  assert.doesNotMatch(html, /Breaker (Bay|East|West|Deep)/);
  assert.equal((html.match(/<ol class="card-assignments">/g) ?? []).length, 17);
  assert.match(html, /North Shore/);
  assert.match(html, /Activity Island/);
  assert.match(html, /East Shore One/);
  assert.doesNotMatch(
    html,
    /Coastal District|Cause delay|Clear simulated delay/i,
  );
});

test("fictional staffing data preserves the approved park structure", async () => {
  const data = JSON.parse(
    await readFile(
      new URL("../data/blue_current_staffing.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(data.employees.length, 74);
  assert.equal(data.rotations.length, 17);
  assert.equal(data.attractions.length, 12);
  assert.equal(
    data.employees.filter((employee) => employee.rotationId !== "N/A").length,
    68,
  );
  assert.ok(
    data.employees.every(
      (employee) => employee.dataClassification === "Synthetic",
    ),
  );
});
