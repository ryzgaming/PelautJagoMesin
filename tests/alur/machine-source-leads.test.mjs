import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({entryPoints:["apps/alur-workflow/functions/source-leads.ts"],bundle:true,format:"esm",write:false});
const { discoverSourceLeads } = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].contents).toString("base64"));
const session = {id:"00000000-0000-4000-8000-000000000001", brand:"YANMAR", model:"6AYM-WET"};

for (const scenario of ["found", "empty", "unavailable"]) {
  test("records " + scenario + " index result without sharing account credentials", async t => {
    const calls = [];
    t.mock.method(globalThis,"fetch",async (url, options) => {
      calls.push({url:new URL(url), options});
      if (calls.length > 1) return Response.json({});
      if (scenario === "unavailable") throw new Error("Index offline");
      const docs = scenario === "found" ? [
        {identifier:"manual-ed1", title:"Machine manual"},
        {identifier:"../invalid", title:"Invalid identifier"},
      ] : [];
      return Response.json({response:{docs}});
    });
    await discoverSourceLeads(session,"fixture");
    assert.equal(calls.length,2);
    assert.equal(calls[0].url.hostname,"archive.org");
    assert.match(calls[0].url.searchParams.get("q"),/6AYM-WET/);
    assert.equal(calls[0].options.headers,undefined);
    assert.ok(!calls[0].url.href.includes(session.id));
    const payload = JSON.parse(calls[1].options.body);
    assert.equal(payload.p_session_id,session.id);
    assert.equal(payload.p_leads.status,scenario);
    assert.deepEqual(payload.p_leads.items,scenario==="found" ? [{title:"Machine manual",url:"https://archive.org/details/manual-ed1"}] : []);
  });
}
