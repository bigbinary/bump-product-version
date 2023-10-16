const core = require("@actions/core");
const exec = require("@actions/exec");
const branch = require("./branch");

const getChangedFiles = async (changedFiles) => {
  const commitableFiles = [];
  for (const path of changedFiles) {
    let content = "";
    const options = {
      listeners: {
        stdout: (data) => {
          content += data.toString();
        },
      },
    };

    await exec.exec("cat", [path], options);

    commitableFiles.push({
      content,
      path,
      mode: "100644",
      type: "commit",
    });
  }
  return commitableFiles;
};

const create = async (octokit, context, branchName) => {
  const commitMessage = core.getInput("commit_message");
  const maxRetries = 5;

  let success = false;
  let retries = 0;

  while (!success && retries < maxRetries) {
    try {
      core.info("Replacing branch...");
      await branch.replace(octokit, context, branchName);

      core.info(`Replaced branch`);

      const newBranch = await octokit.rest.repos.getBranch({
        ...context.repo,
        branch: branchName,
      });
      core.info(`Get branch response: ${JSON.stringify(newBranch)}`);

      const branchSha = newBranch.data.commit.sha;

      const commits = await octokit.rest.repos.listCommits({
        ...context.repo,
        sha: branchSha,
      });
      core.info(`Get commits response: ${JSON.stringify(commits)}`);

      const commitSHA = commits.data[0].sha;

      let changedFiles = [];
      const gitOptions = {};
      gitOptions.listeners = {
        stdout: (data) => {
          const changedFilesString = data.toString();
          changedFiles = changedFilesString
            .split("\n")
            .map((file) => file.split(" ")[2])
            .filter(Boolean);
        },
      };
      await exec.exec("git", ["status", "-s"], gitOptions);

      const commitableFiles = await getChangedFiles(changedFiles);

      const {
        data: { sha: currentTreeSHA },
      } = await octokit.rest.git.createTree({
        ...context.repo,
        tree: commitableFiles,
        base_tree: commitSHA,
        message: commitMessage,
        parents: [commitSHA],
      });

      const {
        data: { sha: newCommitSHA },
      } = await octokit.rest.git.createCommit({
        ...context.repo,
        tree: currentTreeSHA,
        message: commitMessage,
        parents: [commitSHA],
      });

      await octokit.rest.git.updateRef({
        ...context.repo,
        sha: newCommitSHA,
        ref: `heads/${branchName}`,
      });

      core.info(`Commit created on the ${branchName} branch!`);
      success = true;
    } catch (error) {
      core.info(error);
      retries++;
      await new Promise(resolve => setTimeout(resolve, 5000));
      if (retries == maxRetries) {
        core.setFailed(error.message);
      }
    }
  }
};

module.exports = {
  create,
};
