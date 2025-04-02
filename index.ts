import * as github from "@actions/github";
import * as core from "@actions/core";
import { Type as t } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as toml from "js-toml";

const LockFile = t.Object({
  package: t.Array(t.Object({ name: t.String(), version: t.String() })),
});

async function main() {
  const file = core.getInput("file") || "uv.lock";
  const token = core.getInput("token") || process.env.GITHUB_TOKEN;
  const octokit = github.getOctokit(token);

  if (!["pull_request", "pull_request_target"].indexOf(github.context.eventName)) {
    return;
  }

  const pr = await octokit.rest.pulls.get({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: github.context.payload.pull_request!.number,
  });

  const oldPackages = await getPackages(octokit, pr.data.base.repo.owner.login, pr.data.base.repo.name, pr.data.base.ref, file);
  const newPackages = await getPackages(octokit, pr.data.head.repo!.owner.login, pr.data.head.repo!.name, pr.data.head.ref, file);

  const packages: Array<{ package: string, oldVersion: undefined | string, newVersion: undefined | string }> = [];

  for (const pkg of new Set([...oldPackages.keys(), ...newPackages.keys()])) {
    const oldVersion = oldPackages.get(pkg)
    const newVersion = newPackages.get(pkg)
    if (newVersion === oldVersion) {
      continue
    }

    packages.push({ package: pkg, oldVersion, newVersion })
  }


  packages.sort((a, b) => a.package.localeCompare(b.package));

  let output: string[] = []

  for (const { package: pkg, oldVersion, newVersion } of packages) {
    output.push(`| ${pkg} | ${oldVersion || ''} | ${newVersion || ''} |`)
  }

  console.log(output.join('\n'))
}

async function getPackages(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  ref: string,
  path: string,
): Promise<Map<string, string>> {
  const f = await octokit.request(
    `GET https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`,
  );

  const lock = toml.load(f.data);

  const packages = Value.Parse(LockFile, lock).package;

  return new Map(
    packages.map(({ name, version }) => [name, version]),
  );
}

main().catch((err) => {
  throw err;
});
