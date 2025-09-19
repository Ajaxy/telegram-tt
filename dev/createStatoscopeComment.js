import { readFileSync } from 'fs';

import template from '../.github/workflows/statoscope-comment.js';
import createPRComment from './createPRComment.js';

export default async ({ github, context }) => {
  const data = JSON.parse(readFileSync('result.json', 'utf8'));

  const baseUrl = process.env.BASE_URL;
  const parsedUrl = new URL(baseUrl);
  parsedUrl.host = `deploy-preview-${context.issue.number}--${parsedUrl.host}`;
  parsedUrl.pathname = '/statoscope-report.html';
  data.reportUrl = parsedUrl.toString();

  const body = template(data);

  await createPRComment({ github, context, body });
};
