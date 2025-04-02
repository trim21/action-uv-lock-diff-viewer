import type * as github from "@actions/github";

export async function getFile(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  ref: string,
  path: string,
): Promise<string> {
  const f = await octokit.request(
    `GET https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`,
  );

  return f.data as string;
}

const magicComment =
  "<!-- trim21/action-uv-lock-diff-viewer uv.lock viewer -->";

export async function upsertComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  pull_number: number,
  output: string[],
) {
  const comments = await octokit.paginate(
    "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
    {
      owner: owner,
      repo: repo,
      issue_number: pull_number,
    },
  );

  const body = [magicComment, "\n", ...output].join("\n");

  for (const comment of comments) {
    if (comment.body?.includes(magicComment)) {
      await octokit.request(
        "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
        {
          owner: owner,
          repo: repo,
          comment_id: comment.id,
          body,
        },
      );
    }
    return;
  }
  await octokit.request(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
    {
      owner: owner,
      repo: repo,
      issue_number: pull_number,
      body,
    },
  );
}
