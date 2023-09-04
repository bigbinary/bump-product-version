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

    core.info("Creating or Replacing branch...");
    let res = await branch.createOrReplace(octokit, context, branchName);
    core.info(`BRANCH RESPONSE: ${JSON.stringify(res)}`);
    
    core.info("Creating a commit...");
    core.debug(context);
    core.debug(branchName);
    let res2 = await commit.create(octokit, context, branchName);
    core.info(`COMMIT RESPONSE: ${JSON.stringify(res2)}`);

    core.info("Creating a PR...");
    const prNumber = await pr.create(octokit, context, branchName);

    core.debug("PR created:", Boolean(prNumber));
  } catch (error) {
    core.setFailed(error.message);
  }
};

run();
