const protobuf = require("protobufjs");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");

const SCHEMA_PATH = path.join(__dirname, "schema.json");

const DEFAULT_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Origin: "https://m.aiscore.com",
  Referer: "https://m.aiscore.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
};

const DEFAULT_COOKIE = "aiclient=7x9rzu2we0d269l";

async function loadSchema() {
  const jsonDescriptor = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  return protobuf.Root.fromJSON(jsonDescriptor);
}

async function fetchAndDecode(url, messageType, { cookie, headers } = {}) {
  const root = await loadSchema();

  const Response = root.lookupType("onescore.app.v1.Response");
  const DataType = root.lookupType(`onescore.app.v1.${messageType}`);

  console.log(`Fetching: ${url}`);
  console.log(`Decoding as: onescore.app.v1.${messageType}\n`);

  const res = await fetch(url, {
    headers: { ...DEFAULT_HEADERS, ...headers, Cookie: cookie || DEFAULT_COOKIE },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const buffer = await res.buffer();

  if (contentType.includes("application/json")) {
    console.log("Response is JSON (not protobuf):");
    console.log(JSON.stringify(JSON.parse(buffer.toString("utf-8")), null, 2));
    return;
  }

  const response = Response.decode(buffer);
  console.log(`Response code: ${response.code}`);

  if (!response.data || response.data.length === 0) {
    console.log("No data in response.");
    return response;
  }

  const decoded = DataType.decode(response.data);
  const jsonData = DataType.toObject(decoded, {
    longs: String,
    enums: String,
    bytes: String,
    defaults: true,
    arrays: true,
  });

  return { code: response.code, data: jsonData };
}

function decodeFromFile(filePath, messageType) {
  const root = protobuf.loadSync(SCHEMA_PATH);

  const Response = root.lookupType("onescore.app.v1.Response");
  const DataType = root.lookupType(`onescore.app.v1.${messageType}`);

  const buffer = fs.readFileSync(filePath);

  const response = Response.decode(buffer);
  console.log(`Response code: ${response.code}`);

  if (!response.data || response.data.length === 0) {
    console.log("No data in response.");
    return response;
  }

  const decoded = DataType.decode(response.data);
  return DataType.toObject(decoded, {
    longs: String,
    enums: String,
    bytes: String,
    defaults: true,
    arrays: true,
  });
}

function listMessageTypes() {
  const jsonDescriptor = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  const types = [];

  function walk(obj, prefix) {
    if (!obj || typeof obj !== "object") return;
    for (const [key, val] of Object.entries(obj)) {
      if (val && val.fields) {
        types.push(prefix ? `${prefix}.${key}` : key);
      }
      if (val && val.nested) {
        walk(val.nested, prefix ? `${prefix}.${key}` : key);
      }
    }
  }

  walk(jsonDescriptor.nested, "");
  return types;
}

const API_ENDPOINTS = {
  h2h: {
    url: (matchId, lang = 2) =>
      `https://api.aiscore.com/v1/m/api/match/h2h?match_id=${matchId}&lang=${lang}`,
    messageType: "HistoryMatches",
  },
  detail: {
    url: (matchId, lang = 2) =>
      `https://api.aiscore.com/v1/m/api/match/detail?match_id=${matchId}&lang=${lang}`,
    messageType: "MatchDetail",
  },
  lineup: {
    url: (matchId, lang = 2) =>
      `https://api.aiscore.com/v1/m/api/match/lineup?match_id=${matchId}&lang=${lang}`,
    messageType: "MatchLineup",
  },
  live: {
    url: (matchId, lang = 2) =>
      `https://api.aiscore.com/v1/m/api/match/live?match_id=${matchId}&lang=${lang}`,
    messageType: "Matches",
  },
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "list-types") {
    const types = listMessageTypes();
    console.log("Available message types:\n");
    types.forEach((t) => console.log(`  ${t}`));
    return;
  }

  if (command === "decode-file") {
    const filePath = args[1];
    const messageType = args[2];
    if (!filePath || !messageType) {
      console.log("Usage: node index.js decode-file <file> <MessageType>");
      console.log("Example: node index.js decode-file response.bin HistoryMatches");
      process.exit(1);
    }
    const result = decodeFromFile(filePath, messageType);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "fetch") {
    const endpoint = args[1];
    const matchId = args[2];
    const cookie = args[3];

    if (!endpoint || !matchId) {
      console.log("Usage: node index.js fetch <endpoint> <match_id> [cookie]");
      console.log(`Available endpoints: ${Object.keys(API_ENDPOINTS).join(", ")}`);
      console.log("Example: node index.js fetch h2h g6763i5d2mjao7r");
      console.log('Example: node index.js fetch h2h g6763i5d2mjao7r "aiclient=abc123"');
      process.exit(1);
    }

    const ep = API_ENDPOINTS[endpoint];
    if (!ep) {
      console.log(`Unknown endpoint: ${endpoint}`);
      console.log(`Available: ${Object.keys(API_ENDPOINTS).join(", ")}`);
      process.exit(1);
    }

    const result = await fetchAndDecode(ep.url(matchId), ep.messageType, {
      cookie: cookie || DEFAULT_COOKIE,
    });
    if (result) {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  if (command === "fetch-url") {
    const url = args[1];
    const messageType = args[2];
    const cookie = args[3];

    if (!url || !messageType) {
      console.log("Usage: node index.js fetch-url <url> <MessageType> [cookie]");
      console.log("Example: node index.js fetch-url https://api.aiscore.com/v1/m/api/match/h2h?match_id=xxx&lang=2 HistoryMatches");
      process.exit(1);
    }

    const result = await fetchAndDecode(url, messageType, {
      cookie: cookie || DEFAULT_COOKIE,
    });
    if (result) {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  console.log("kira-crawl-service - Protobuf decoder for aiscore API\n");
  console.log("Commands:");
  console.log("  node index.js list-types                          List all protobuf message types");
  console.log("  node index.js decode-file <file> <MessageType>    Decode a binary file");
  console.log("  node index.js fetch <endpoint> <match_id> [cookie]  Fetch & decode from API");
  console.log("  node index.js fetch-url <url> <Type> [cookie]     Fetch & decode custom URL");
  console.log("\nEndpoints:", Object.keys(API_ENDPOINTS).join(", "));
  console.log("\nExamples:");
  console.log("  node index.js fetch h2h g6763i5d2mjao7r");
  console.log('  node index.js fetch h2h g6763i5d2mjao7r "aiclient=xyz"');
  console.log("  node index.js decode-file response.bin HistoryMatches");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
