/* eslint-env node */

const fs = require('fs');
const createPRComment = require('./createPRComment');
const template = require('../.github/workflows/statoscope-comment');

module.exports = async ({ github, context }) => {
  const data = JSON.parse(fs.readFileSync('result.json', 'utf8'));
  data.prNumber = context.issue.number;
  const body = template(data);

  await createPRComment({ github, context, body });
};
