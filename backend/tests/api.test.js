process.env.DB_PATH = "" + require("os").tmpdir() + "/test-bq.db";
require("fs").rmSync("" + require("os").tmpdir() + "/test-bq.db", { force: true });
const realFetch = global.fetch;
let nextSolution = 5;
// Fake the Banana API so tests work offline.
global.fetch = (url, opts) => {
    if (String(url).includes("marcconrad")) {
        return Promise.resolve({ ok: true, json: async () => ({ question: "http://x/img.png", solution: nextSolution }) });
    }
    return realFetch(url, opts);
};
const app = require(require("path").join(__dirname, "..", "server.js"));
const assert = require("assert");

(async () => {
    const server = app.listen(0);
    const base = "http://localhost:" + server.address().port;
    let cookie = "";
    const call = async (method, path, body) => {
        const r = await realFetch(base + path, { method, redirect: "manual",
            headers: { "Content-Type": "application/json", cookie },
            body: body ? JSON.stringify(body) : undefined });
        const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
        let j = null; try { j = await r.json(); } catch {}
        return { status: r.status, j };
    };

    assert.equal((await call("GET", "/api/puzzle")).status, 401);
    await call("POST", "/api/auth/register", { username: "tester", password: "password123" });
    assert.equal((await call("POST", "/api/auth/login", { username: "tester", password: "password123" })).status, 200);

    await call("POST", "/api/game/start");
    let p = await call("GET", "/api/puzzle");
    assert(!("solution" in p.j), "solution must not leak");
    let a = await call("POST", "/api/answer", { answer: 5 });
    assert.equal(a.j.correct, true);
    assert(a.j.score >= 100 && a.j.score <= 150, "score " + a.j.score);
    // same puzzle cannot be answered twice
    assert.equal((await call("POST", "/api/answer", { answer: 5 })).status, 404);

    // wrong answers reset the streak but do not end the game
    await call("GET", "/api/puzzle");
    let wrong = await call("POST", "/api/answer", { answer: 999 });
    assert.equal(wrong.j.wrong, 1);
    assert.equal(wrong.j.gameOver, false);
    assert.equal(wrong.j.streak, 0);
    assert.equal((await call("GET", "/api/puzzle")).status, 200);

    // hints, stats, and leaderboard were removed
    assert.equal((await call("POST", "/api/hint")).status, 404);
    assert.equal((await call("GET", "/api/stats")).status, 404);
    assert.equal((await call("GET", "/api/leaderboard")).status, 404);

    // restart works
    await call("POST", "/api/game/start");
    await call("GET", "/api/puzzle");
    assert.equal((await call("POST", "/api/answer", { answer: 5 })).j.correct, true);

    // quitting resets the game and allows a fresh puzzle
    await call("POST", "/api/game/quit");
    assert.equal((await call("GET", "/api/puzzle")).status, 200);

    // bad input
    assert.equal((await call("POST", "/api/answer", { answer: "5" })).status, 400);
    assert.equal((await call("POST", "/api/answer", { answer: 1.5 })).status, 400);

    console.log("ALL TESTS PASSED");
    require("../database").close();
    server.close();
})().catch(e => { console.error("FAIL", e); process.exit(1); });
