const core = require("@actions/core");

const create = async (octokit, context, branch) => {
  const reference = `refs/heads/${branch}`;

  // throws HttpError if branch already exists.
  try {
    await octokit.rest.repos.getBranch({
      ...context.repo,
      branch,
    });
  } catch (error) {
    core.info(JSON.stringify(error));
    if (error.name === "HttpError" && error.status === 404) {
      const response = await octokit.rest.git.createRef({
        ref: reference,
        sha: context.sha,
        ...context.repo,
      });
      core.info(`Branch creation response: ${JSON.stringify(response)}`);

      return response?.data?.ref === reference;
    } else {
      throw Error(error);
    }
  }
};

const destroy = async (octokit, context, branch) => {
  const reference = `heads/${branch}`;

  try {
    const response = await octokit.rest.git.deleteRef({
      ref: reference,
      ...context.repo,
    });
    return response;
  } catch (error) {
    core.warning(error.message);
  }
};

const replace = async (octokit, context, branchName) => {
  try {
    core.debug(`Creating branch ${branchName}`);
    let isBranchCreated = await create(octokit, context, branchName);

    core.debug("Branch created:", Boolean(isBranchCreated));
    core.info("Deleting the existing branch...");
    const isBranchDeleted = await destroy(octokit, context, branchName);
    core.info(`Branch deleted: ${Boolean(isBranchDeleted)}`);

    core.info(`Creating a new branch ${branchName}`);
    isBranchCreated = await create(octokit, context, branchName);
    core.info(`Branch created: ${Boolean(isBranchCreated)}`);
  } catch (error) {
    core.setFailed(error.message);
  }
};

module.exports = { replace };
