import PackageJson from "@npmcli/package-json";
import { glob } from "glob";
import fs from "node:fs";
import path from "node:path";

let __dirname = path.dirname(new URL(import.meta.url).pathname);
let rootDir = path.resolve(__dirname, "..");

// 1. remove CHANGELOG.md from './examples/*'
let changelogs = glob.sync("./examples/*/CHANGELOG.md", { cwd: rootDir });

for (let file of changelogs) {
  fs.rmSync(path.resolve(rootDir, file));
}

// 2. remove `version: null` from './examples/*/package.json'
let packageJsons = glob.sync("./examples/*/package.json", { cwd: rootDir });

for (let file of packageJsons) {
  let pkg = await PackageJson.load(path.dirname(file));
  if (!pkg.content.version) {
    delete pkg.content.version;
    await pkg.save();
  }
}
