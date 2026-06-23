import { spawnSync } from "node:child_process";

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

const output = result.stdout || result.stderr;
let report;
try {
  report = JSON.parse(output);
} catch {
  console.error(output);
  throw new Error("Failed to parse npm audit JSON output");
}

const vulnerabilities = report.vulnerabilities ?? {};
const unexpected = [];
const allowed = [];

for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (isAllowedNextPostcssFinding(name, vulnerability)) {
    allowed.push(name);
  } else {
    unexpected.push({ name, vulnerability });
  }
}

if (unexpected.length > 0) {
  console.error("Unexpected npm audit findings:");
  for (const finding of unexpected) {
    console.error(`- ${finding.name}: severity=${finding.vulnerability.severity}`);
  }
  process.exit(1);
}

if (allowed.length > 0) {
  console.warn(
    `Audit passed with documented residual finding(s): ${allowed.join(", ")}. ` +
      "Current npm fix path downgrades Next to 9.3.3, so this remains tracked until Next ships patched bundled PostCSS.",
  );
}

console.log("npm audit gate passed");

function isAllowedNextPostcssFinding(name, vulnerability) {
  if (name !== "next" && name !== "postcss") return false;
  if (vulnerability.severity !== "moderate") return false;
  const nodes = vulnerability.nodes ?? [];
  const via = vulnerability.via ?? [];
  const fix = vulnerability.fixAvailable;
  const isNextPostcss =
    name === "next"
      ? via.includes("postcss")
      : via.some((item) => typeof item === "object" && item.name === "postcss");
  return (
    isNextPostcss &&
    nodes.some((node) => node.includes("node_modules/next")) &&
    fix &&
    fix.name === "next" &&
    fix.version === "9.3.3" &&
    fix.isSemVerMajor === true
  );
}
