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
  "src/server/createServer.js",
  "src/server/game/cards.js",
  "src/shared/cards.js",
  "src/bots/player.js",
  "src/client/table3d.js",
  "src/client/ritual-scene.mjs",
];

function collectJavaScript(directory) {
  return fs.readdirSync(path.join(projectRoot, directory), { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory()
      ? collectJavaScript(relative)
      : /\.(?:js|mjs)$/.test(entry.name) ? [relative] : [];
  });
}

const jsFilesToCheck = ["server.js", "public/script.js",
  ...collectJavaScript("src/server"), ...collectJavaScript("src/shared"),
  ...collectJavaScript("src/bots"), ...collectJavaScript("src/client"),
  ...collectJavaScript("public/js")];

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

  const isModule = relPath === "public/script.js" || /^(public[\\/]js|src[\\/]client)[\\/]/.test(relPath);
  const result = spawnSync(process.execPath, isModule
    ? ["--input-type=module", "--check"] : ["--check", absolutePath], {
    encoding: "utf8",
    ...(isModule ? { input: fs.readFileSync(absolutePath, "utf8") } : {}),
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
