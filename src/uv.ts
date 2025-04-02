import { Type as t } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as toml from "js-toml";

const LockFile = t.Object({
  package: t.Array(t.Object({ name: t.String(), version: t.String() })),
});

function getPackages(lockFileContent: string): Map<string, string> {
  const lock = toml.load(lockFileContent);

  const packages = Value.Parse(LockFile, lock).package;

  return new Map(packages.map(({ name, version }) => [name, version]));
}

export function diffLockFile(oldLock: string, newLock: string): string[] {
  const oldPackages = getPackages(oldLock);
  const newPackages = getPackages(newLock);

  const packages: Array<{
    package: string;
    oldVersion: undefined | string;
    newVersion: undefined | string;
  }> = [];

  for (const pkg of new Set([...oldPackages.keys(), ...newPackages.keys()])) {
    const oldVersion = oldPackages.get(pkg);
    const newVersion = newPackages.get(pkg);
    if (newVersion === oldVersion) {
      continue;
    }

    packages.push({ package: pkg, oldVersion, newVersion });
  }

  packages.sort((a, b) => a.package.localeCompare(b.package));

  const output = ["| package | old | new |", "|   :-:   | :-: | :-: |"];

  for (const { package: pkg, oldVersion, newVersion } of packages) {
    output.push(`| ${pkg} | ${oldVersion || ""} | ${newVersion || ""} |`);
  }

  return output;
}
