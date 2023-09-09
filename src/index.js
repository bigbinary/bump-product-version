const core = require("@actions/core");
const github = require("@actions/github");

const bumpGem = require("./bump");
const branch = require("./branch");
const commit = require("./commit");
const pr = require("./pr");

const run = async () => {
  try {
    core.info("Bumping gem version...");
    await bumpGem();

    core.info("Committing and pushing the new version...");
    const token = core.getInput("token");
    const octokit = github.getOctokit(token);
    const branchName = core.getInput("new_branch");
    const context = github.context;

    core.info("Replacing branch...");
    await branch.replace(octokit, context, branchName);

    core.info("Creating a commit...");
    await commit.create(octokit, context, branchName);

    core.info("Creating a PR...");
    const prNumber = await pr.create(octokit, context, branchName);

    core.info(`PR created: ${Boolean(prNumber)}`);
  } catch (error) {
    core.setFailed(error.message);
  }
};

run();
