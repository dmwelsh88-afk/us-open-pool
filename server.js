const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = process.env.DATA_FILE || path.join(DATA_DIR, "db.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const PUBLIC_DIR = path.join(__dirname, "public");

const tiers = {
  1: [
    "Scottie Scheffler",
    "Rory McIlroy",
    "Jon Rahm",
    "Cameron Young",
    "Matt Fitzpatrick",
    "Tommy Fleetwood",
    "Xander Schauffele",
    "Bryson DeChambeau",
    "Ludvig Aberg",
    "Brooks Koepka",
    "Wyndham Clark",
    "Collin Morikawa",
    "Russell Henley",
    "Sam Burns",
    "Tyrrell Hatton",
    "Chris Gotterup",
    "Justin Rose",
    "Justin Thomas",
    "Patrick Reed",
    "Si Woo Kim",
    "Viktor Hovland",
    "J J Spaun",
    "Patrick Cantlay"
  ],
  2: [
    "Hideki Matsuyama",
    "Joaquin Niemann",
    "Jordan Spieth",
    "Shane Lowry",
    "Robert MacIntyre",
    "Ben Griffin",
    "Min Woo Lee",
    "Aaron Rai",
    "Kristoffer Reitan",
    "Maverick McNealy",
    "Adam Scott",
    "Alex Fitzpatrick",
    "Cameron Smith",
    "Harris English",
    "Jake Knapp",
    "Nicolai Hojgaard",
    "Akshay Bhatia",
    "Bud Cauley",
    "Gary Woodland",
    "Kurt Kitayama",
    "Ryan Gerard",
    "Sepp Straka"
  ],
  3: [
    "Alex Noren",
    "Alex Smalley",
    "J.T. Poston",
    "Jackson Koivun",
    "Jason Day",
    "Keegan Bradley",
    "Nick Taylor",
    "Rickie Fowler",
    "Corey Conners",
    "Daniel Berger",
    "David Puig",
    "Dustin Johnson",
    "Jacob Bridgeman",
    "Ryan Fox",
    "Sahith Theegala",
    "Harry Hall",
    "Keith Mitchell",
    "Sungjae Im",
    "Tom Kim",
    "Ben James",
    "Brian Harman",
    "Davis Thompson",
    "Michael Brennan",
    "Ryo Hisatsune",
    "Sudarshan Yellamaraju",
    "Michael Kim",
    "Sam Stevens",
    "Andrew Novak",
    "Andrew Putnam",
    "Billy Horschel",
    "Carlos Ortiz",
    "Jackson Suber",
    "Jayden Schaper",
    "Johnny Keefer",
    "Lucas Herbert",
    "Matt McCarty",
    "Max Greyserman"
  ],
  4: [
    "Chris Kirk",
    "Emiliano Grillo",
    "Matti Schmid",
    "Max McGreevy",
    "Pierceson Coody",
    "John Parry",
    "Nico Echavarria",
    "Patrick Rodgers",
    "William Mouw",
    "Jimmy Stanger",
    "Kevin Roy",
    "Peter Uihlein",
    "Adrien Dumont De Chassart",
    "Alejandro Tosti",
    "Ben Kohles",
    "Caleb Surratt",
    "Laurie Canter",
    "Matthew Jordan",
    "Miles Russell",
    "Nathan Kimsey",
    "Preston Stout",
    "Zac Blair",
    "Neal Shipley",
    "Adrien Saddier",
    "Angel Hidalgo",
    "Ben Silverman",
    "Nick Hardy",
    "Niklas Norgaard",
    "Padraig Harrington",
    "Brandon Wu",
    "Bryan Lee",
    "Carl Yuan",
    "Chandler Phillips",
    "Cole Hammer",
    "Cooper Dossey",
    "Dylan Wu",
    "Graeme McDowell",
    "Harry Higgs",
    "Hennie Du Plessis",
    "Jack Schoenberger",
    "Jackson Van Paris",
    "James Nicholas",
    "Rocco Repetto Taylor",
    "T K Kim",
    "Taylor Montgomery",
    "Ugo Cussaud",
    "Eric Lee",
    "Ethan Fang",
    "Filippo Celli",
    "Greyson Leach",
    "Jackson Herrington",
    "Jake Peacock",
    "Mason Howell",
    "Ryder Cowan",
    "Ryuichi Oiwa",
    "Taihei Sato",
    "Arni Sveinsson",
    "Brandon Holtz",
    "Chase Kyes",
    "Giuseppe Puebla",
    "Hamilton Coleman",
    "Jake Sollon",
    "Kaito Onishi",
    "Logan Reilly",
    "Matthew Robles",
    "Robbie Higgins",
    "Spencer Tibbits",
    "J B Holmes",
    "Jackson Ormond",
    "Manav Shah",
    "Marcelo Rozo",
    "Marek Fleming",
    "Mateo Pulcini",
    "Vaughn Harber"
  ]
};

const allGolfers = Object.entries(tiers).flatMap(([tier, names]) =>
  names.map((name) => ({ name, tier: Number(tier) }))
);
const golferTier = new Map(allGolfers.map((golfer) => [golfer.name, golfer.tier]));

function blankDb() {
  return { entries: [], scores: {}, updatedAt: new Date().toISOString() };
}

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return blankDb();
  }
}

function writeDb(db) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  db.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  broadcast();
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json",
    ...headers
  });
  res.end(payload);
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireAdmin(req, res) {
  if (!ADMIN_PASSWORD) {
    send(res, 503, { error: "Admin password is not configured on the server." });
    return false;
  }
  const supplied = String(req.headers["x-admin-password"] || "");
  if (!timingSafeEqual(supplied, ADMIN_PASSWORD)) {
    send(res, 401, { error: "Admin password required." });
    return false;
  }
  return true;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
  });
}

function roundValue(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedScore(raw = {}) {
  return {
    rounds: [0, 1, 2, 3].map((i) => roundValue(raw.rounds?.[i])),
    status: ["active", "cut", "wd"].includes(raw.status) ? raw.status : "active",
    finish: raw.finish === "" || raw.finish === null || raw.finish === undefined ? null : Number(raw.finish)
  };
}

function golferTotal(rawScore = {}) {
  const score = normalizedScore(rawScore);
  return score.rounds.reduce((sum, value, index) => {
    if (typeof value === "number") return sum + value;
    if (score.status === "wd") return sum + 10;
    if (score.status === "cut" && index >= 2) return sum + 10;
    return sum;
  }, 0);
}

function golferBonus(rawScore = {}) {
  const finish = normalizedScore(rawScore).finish;
  if (finish === 1) return -5;
  if (finish >= 2 && finish <= 5) return -2;
  return 0;
}

function entryPicks(entry) {
  return ["1", "2", "3", "4"].flatMap((tier) => entry.picks?.[tier] || []);
}

function leaderboard(db) {
  return db.entries
    .map((entry) => {
      const golfers = entryPicks(entry)
        .map((name) => ({
          name,
          tier: golferTier.get(name),
          total: golferTotal(db.scores[name]),
          bonus: golferBonus(db.scores[name]),
          score: normalizedScore(db.scores[name])
        }))
        .sort((a, b) => a.total - b.total || a.name.localeCompare(b.name));
      const counting = golfers.slice(0, 4);
      const tiebreakers = golfers.slice(4).map((golfer) => golfer.total);
      const baseScore = counting.reduce((sum, golfer) => sum + golfer.total, 0);
      const bonus = golfers.reduce((sum, golfer) => sum + golfer.bonus, 0);
      return {
        id: entry.id,
        name: entry.name,
        venmo: entry.venmo || "",
        paid: Boolean(entry.paid),
        picks: entry.picks,
        golfers,
        counting: counting.map((golfer) => golfer.name),
        baseScore,
        bonus,
        totalScore: baseScore + bonus,
        tiebreakers,
        createdAt: entry.createdAt
      };
    })
    .sort((a, b) => {
      if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
      for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i += 1) {
        const left = a.tiebreakers[i] ?? 999;
        const right = b.tiebreakers[i] ?? 999;
        if (left !== right) return left - right;
      }
      return a.name.localeCompare(b.name);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function publicState() {
  const db = readDb();
  return {
    tiers,
    entries: db.entries,
    scores: Object.fromEntries(allGolfers.map(({ name }) => [name, normalizedScore(db.scores[name])])),
    leaderboard: leaderboard(db),
    updatedAt: db.updatedAt
  };
}

function validateEntry(input) {
  const name = String(input.name || "").trim();
  if (!name) return "Please enter a name.";
  const picks = input.picks || {};
  const expected = { 1: 3, 2: 2, 3: 2, 4: 1 };
  const seen = new Set();
  for (const [tier, count] of Object.entries(expected)) {
    const names = Array.isArray(picks[tier]) ? picks[tier] : [];
    if (names.length !== count) return `Tier ${tier} needs exactly ${count} pick${count === 1 ? "" : "s"}.`;
    for (const golfer of names) {
      if (golferTier.get(golfer) !== Number(tier)) return `${golfer} is not in Tier ${tier}.`;
      if (seen.has(golfer)) return `${golfer} was selected more than once.`;
      seen.add(golfer);
    }
  }
  return null;
}

const clients = new Set();
function broadcast() {
  const payload = `data: ${JSON.stringify({ type: "update", at: new Date().toISOString() })}\n\n`;
  for (const client of clients) client.write(payload);
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const safePath = path.normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden");
  fs.readFile(filePath, (error, data) => {
    if (error) return send(res, 404, "Not found");
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml"
    };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/state") {
      return send(res, 200, publicState());
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, { ok: true, dataFile: DATA_FILE });
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      res.write("\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/entries") {
      const body = await parseBody(req);
      const validationError = validateEntry(body);
      if (validationError) return send(res, 400, { error: validationError });
      const db = readDb();
      const entry = {
        id: crypto.randomUUID(),
        name: String(body.name).trim(),
        venmo: String(body.venmo || "").trim(),
        paid: false,
        picks: {
          1: body.picks["1"],
          2: body.picks["2"],
          3: body.picks["3"],
          4: body.picks["4"]
        },
        createdAt: new Date().toISOString()
      };
      db.entries.push(entry);
      writeDb(db);
      return send(res, 201, entry);
    }

    if (req.method === "POST" && url.pathname === "/api/scores") {
      if (!requireAdmin(req, res)) return;
      const body = await parseBody(req);
      const updates = Array.isArray(body.updates) ? body.updates : [body];
      const db = readDb();
      for (const update of updates) {
        const name = String(update.name || "").trim();
        if (!golferTier.has(name)) return send(res, 400, { error: `${name || "Golfer"} is not in this pool.` });
        db.scores[name] = normalizedScore(update);
      }
      writeDb(db);
      return send(res, 200, publicState());
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/entries/")) {
      if (!requireAdmin(req, res)) return;
      const id = url.pathname.split("/").pop();
      const body = await parseBody(req);
      const db = readDb();
      const entry = db.entries.find((item) => item.id === id);
      if (!entry) return send(res, 404, { error: "Entry not found." });
      if (typeof body.paid === "boolean") entry.paid = body.paid;
      if (typeof body.name === "string" && body.name.trim()) entry.name = body.name.trim();
      if (typeof body.venmo === "string") entry.venmo = body.venmo.trim();
      writeDb(db);
      return send(res, 200, entry);
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/entries/")) {
      if (!requireAdmin(req, res)) return;
      const id = url.pathname.split("/").pop();
      const db = readDb();
      db.entries = db.entries.filter((entry) => entry.id !== id);
      writeDb(db);
      return send(res, 200, { ok: true });
    }

    serveStatic(req, res);
  } catch (error) {
    send(res, 500, { error: error.message || "Server error." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`U.S. Open pool running at http://${HOST}:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
