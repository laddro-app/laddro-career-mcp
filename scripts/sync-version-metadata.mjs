import { readFile, writeFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const serverJsonUrl = new URL("../server.json", import.meta.url);
const serverJson = JSON.parse(await readFile(serverJsonUrl, "utf8"));

serverJson.version = packageJson.version;

for (const packageEntry of serverJson.packages ?? []) {
  if (packageEntry.identifier === packageJson.name) {
    packageEntry.version = packageJson.version;
  }
}

await writeFile(serverJsonUrl, `${JSON.stringify(serverJson, null, 2)}\n`);
