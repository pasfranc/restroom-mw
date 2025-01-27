import test from "ava";
import request from "supertest";
import express from "express";
process.env.ZENCODE_DIR = "./test/fixtures";
const core = require("../../core").default;

test("Check that the middleware handle wrong identation in yaml", async (t) => {
  const app = express();
  app.use("/api/*", core);
  const res = await request(app).post("/api/bad-identation-chain.chain");

  t.true(res.body.exception.includes("bad indentation of a mapping entry"));
  t.is(res.status, 500);
});

test("Check that the middleware handle missing start in yaml", async (t) => {
  const app = express();
  app.use("/api/*", core);
  const res = await request(app).post("/api/missing-start.chain");

  t.true(
    res.body.exception.includes(
      "Yml is incomplete. Start (start:) first level definition is missing!"
    )
  );
  t.is(res.status, 500);
});

test("Check that the middleware detects a loop in yaml", async (t) => {
  const app = express();
  app.use("/api/*", core);
  const res = await request(app).post("/api/detect-loop.chain");

  t.true(res.body.exception.includes("Loop detected. Execution is aborted"));
  t.is(res.status, 500);
});

test("Check that the middleware detects when zenfile is missing into contract block", async (t) => {
  const app = express();
  app.use("/api/*", core);
  const res = await request(app).post("/api/missing-zenfile.chain");

  t.true(res.body.exception.includes("Zen file is missing for block id"));
  t.is(res.status, 500);
});

test("Check that the middleware provide context when debug is on for missing zenfile", async (t) => {
  const app = express();
  app.use("/api/*", core);
  const res = await request(app).post("/api/missing-zenfile-debug.chain");

  t.is(res.body.context.debugEnabled, true);
  t.is(res.status, 500);
});

test("Check that the middleware provide context when debug is on for gpp sawroom sample", async (t) => {
  const app = express();
  app.use("/api/*", core);
  const res = await request(app).post("/api/gpp-sawroom-sample-debug.chain");

  t.is(res.body.context.debugEnabled, true);
  t.is(res.status, 200);
});

test("Check that the middleware detects a duplicated mapping key in yaml blocks", async (t) => {
  const app = express();
  app.use("/api/*", core);
  const res = await request(app).post("/api/duplicated-mapping-key.chain");

  t.true(res.body.exception.includes("YAMLException: duplicated mapping key"));
  t.is(res.status, 500);
});

test("Check that the middleware detects two different paths in yml", async (t) => {
  const app = express();
  app.use("/api/*", core);
  const res = await request(app).post("/api/different-paths.chain");

  t.true(
    res.body.exception.includes(
      "Permission Denied. The paths in the yml cannot be different"
    )
  );
  t.is(res.status, 500);
});
