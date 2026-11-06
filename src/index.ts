import * as github from "@actions/github";
import * as core from "@actions/core";
import { minimatch } from "minimatch";
import { getFile, upsertComment } from "./github";

import * as uv from "./uv";

const lockFileMap: Record<string, (oldLock: string, newLock: string) => string[]> = {
  "**/uv.lock": uv.diffLockFile,
};

async function main() {
  if (!["pull_request", "pull_request_target"].includes(github.context.eventName)) {
    return;
  }

  const pull_request = github.context.payload.pull_request;
  if (!pull_request) {
    return;
  }

  const token = core.getInput("token", { required: true });
  const octokit = github.getOctokit(token);

  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;
  const pull_number = pull_request.number;

  const pr = await octokit.rest.pulls.get({ owner, repo, pull_number });

  const files = await octokit.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
    owner: owner,
    repo: repo,
    pull_number,
  });

  const finalOutput: string[] = [];

  for (const file of files) {
    for (const [pattern, diff] of Object.entries(lockFileMap)) {
      if (!minimatch(file.filename, pattern)) {
        continue;
      }

      const oldLock = await getFile(
        octokit,
        pr.data.base.repo.owner.login,
        pr.data.base.repo.name,
        pr.data.base.sha,
        file.filename,
      );
      const newLock = await getFile(
        octokit,
        pr.data.head.repo.owner.login,
        pr.data.head.repo.name,
        pr.data.head.sha,
        file.filename,
      );

      const output = diff(oldLock, newLock);
      finalOutput.push(`## ${file.filename}`, "", ...output);
    }
  }

  if (finalOutput.length === 0) {
    return;
  }

  await upsertComment(octokit, owner, repo, pull_number, finalOutput);
}

main().catch((error) => {
  throw error;
});
