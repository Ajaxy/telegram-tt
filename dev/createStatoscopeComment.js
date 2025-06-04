import { readFileSync } from 'fs';

import template from '../.github/workflows/statoscope-comment.js';
import createPRComment from './createPRComment.js';

export default async ({ github, context }) => {
  const data = JSON.parse(readFileSync('result.json', 'utf8'));
  data.prNumber = context.issue.number;
  const body = template(data);

  await createPRComment({ github, context, body });
};
