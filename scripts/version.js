import chalk from "chalk";
import { glob } from "glob";
import jsonfile from "jsonfile";
import { execSync } from "node:child_process";
import path from "node:path";
import Confirm from "prompt-confirm";
import semver from "semver";

let rootDir = path.join(import.meta.dirname, "..");
let packageDir = path.join(rootDir, "packages");

let packages = glob
  .sync("./*/package.json", { cwd: packageDir })
  .map((file) => path.dirname(file));

run(process.argv.slice(2)).then(
  () => {
    process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

/**
 * @param {string[]} args
 */
async function run(args) {
  let givenVersion = args[0];
  let prereleaseId = args[1];

  ensureCleanWorkingDirectory();

  // Get the next version number
  let currentVersion = await getPackageVersion("vite-plugin-svg-sprite");
  let nextVersion = semver.valid(givenVersion);
  if (nextVersion == null) {
    nextVersion = getNextVersion(currentVersion, givenVersion, prereleaseId);
  }

  // Confirm the next version number
  if (prereleaseId !== "--skip-prompt") {
    let answer = await prompt(
      `Are you sure you want to bump version ${currentVersion} to ${nextVersion}? [Yn] `,
    );
    if (answer === false) return 0;
  }

  await incrementVersion(nextVersion);
}

/**
 * @param {string} nextVersion
 */
async function incrementVersion(nextVersion) {
  // Update version numbers in package.json for all packages
  for (let name of packages) {
    await updateVersion(`${name}`, nextVersion);
  }

  // Commit and tag
  execSync(`git commit --all --message="Version ${nextVersion}"`);
  execSync(`git tag -a -m "Version ${nextVersion}" v${nextVersion}`);
  console.log(chalk.green(`  Committed and tagged version ${nextVersion}`));
}

/**
 * @param {string} packageName
 * @param {(json: import('type-fest').PackageJson) => any} transform
 */
async function updatePackageConfig(packageName, transform) {
  let file = packageJson(packageName, "packages");
  try {
    let json = await jsonfile.readFile(file);
    if (!json) {
      console.log(`No package.json found for ${packageName}; skipping`);
      return;
    }
    transform(json);
    await jsonfile.writeFile(file, json, { spaces: 2 });
  } catch {
    return;
  }
}

/**
 * @param {string} packageName
 * @param {string} nextVersion
 * @param {string} [successMessage]
 */
async function updateVersion(packageName, nextVersion, successMessage) {
  await updatePackageConfig(packageName, (config) => {
    config.version = nextVersion;
  });
  let logName = `@mcansh/${packageName}`;
  console.log(
    chalk.green(
      `  ${
        successMessage ||
        `Updated ${chalk.bold(logName)} to version ${chalk.bold(nextVersion)}`
      }`,
    ),
  );
}

/**
 * @param {string|undefined} currentVersion
 * @param {string} givenVersion
 * @param {string} [prereleaseId]
 * @returns
 */
function getNextVersion(currentVersion, givenVersion, prereleaseId = "pre") {
  if (givenVersion == null) {
    console.error("Missing next version. Usage: node version.js [nextVersion]");
    process.exit(1);
  }

  let nextVersion;
  if (givenVersion === "experimental") {
    let hash = execSync(`git rev-parse --short HEAD`).toString().trim();
    nextVersion = `0.0.0-experimental-${hash}`;
  } else {
    // @ts-ignore
    nextVersion = semver.inc(currentVersion, givenVersion, prereleaseId);
  }

  if (nextVersion == null) {
    console.error(`Invalid version specifier: ${givenVersion}`);
    process.exit(1);
  }

  return nextVersion;
}

/**
 * @returns {void}
 */
function ensureCleanWorkingDirectory() {
  let status = execSync(`git status --porcelain`).toString().trim();
  let lines = status.split("\n");
  if (!lines.every((line) => line === "" || line.startsWith("?"))) {
    console.error(
      "Working directory is not clean. Please commit or stash your changes.",
    );
    process.exit(1);
  }
}

/**
 * @param {string} packageName
 * @param {string} [directory]
 * @returns {string}
 */
function packageJson(packageName, directory = "") {
  return path.join(rootDir, directory, packageName, "package.json");
}

/**
 * @param {string} packageName
 * @returns {Promise<string | undefined>}
 */
async function getPackageVersion(packageName) {
  let file = packageJson(packageName, "packages");
  let json = await jsonfile.readFile(file);
  return json.version;
}

/**
 * @param {string} question
 * @returns {Promise<string | boolean>}
 */
async function prompt(question) {
  let confirm = new Confirm(question);
  let answer = await confirm.run();
  return answer;
}
