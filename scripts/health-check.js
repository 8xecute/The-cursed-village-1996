const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");

const requiredFiles = [
  "package.json",
  "server.js",
  "public/index.html",
  "public/script.js",
  "public/style.css",
  "src/gameLogic.js",
];

const jsFilesToCheck = ["server.js", "public/script.js", "src/gameLogic.js"];

let hasError = false;

function fail(message) {
  hasError = true;
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

for (const relPath of requiredFiles) {
  const absolutePath = path.join(projectRoot, relPath);
  if (fs.existsSync(absolutePath)) {
    pass(`Found ${relPath}`);
  } else {
    fail(`Missing required file ${relPath}`);
  }
}

for (const relPath of jsFilesToCheck) {
  const absolutePath = path.join(projectRoot, relPath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Cannot syntax check missing file ${relPath}`);
    continue;
  }

  const result = spawnSync(process.execPath, ["--check", absolutePath], {
    encoding: "utf8",
  });

  if (result.status === 0) {
    pass(`Syntax OK ${relPath}`);
  } else {
    fail(`Syntax error in ${relPath}`);
    if (result.stderr && result.stderr.trim()) {
      console.error(result.stderr.trim());
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log("Health check passed.");
