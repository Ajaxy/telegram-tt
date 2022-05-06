const Telegraph = require('telegraph-node');
const { JSDOM } = require('jsdom');
const { gitlogPromise } = require('gitlog');

// CONSTANTS

const AUTH_TOKEN = process.env.TELEGRAPH_TOKEN;
const version = require('../package.json').version;

const gitOptions = {
  repo: '.',
  branch: 'master',
  number: 100,
  fields: ['hash', 'subject', 'committerDate'],
};

const pageTemplate = `
<body>\
    <h3>Commits since ${version}</h3>\
    <blockquote>This list is automatically updated when a new commit pushed to the beta repo</blockquote>\
    <ul id="list"></ul>\
    <blockquote>Last updated ${new Date().toLocaleDateString('en-CA')}</blockquote>\
</body>
`.trim();

// MAIN

function updateChangelog() {
  preparePage().then((dom) => {
    updateTelegraph(dom);
  });
}

updateChangelog();

// UTIL

async function updateTelegraph(dom) {
  const api = new Telegraph();
  const content = domToNode(dom.window.document.body).children;
  const result = await api.editPage(AUTH_TOKEN, 'WebZ-Beta-04-01', 'Telegram WebZ Beta Changelog', content, {
    author_name: 'WebZ team',
    author_url: 'https://t.me/webztalks',
  });
  // eslint-disable-next-line no-console
  console.log(result);
}

async function preparePage() {
  const dom = new JSDOM(pageTemplate);

  const commits = await getCommitsSince(version);

  commits.forEach((commit) => (
    dom.window.document.getElementById('list').appendChild(renderCommit(dom, commit))
  ));

  if (!commits?.length) {
    const li = dom.window.document.createElement('li');
    li.innerHTML = `<p>Nothing changed since ${version}</p>`;
    dom.window.document.getElementById('list').appendChild(li);
  }

  return dom;
}

function renderCommit(dom, commit) {
  const li = dom.window.document.createElement('li');
  const subject = commit.subject.replaceAll(/`(.+)`/g, '<code>$1</code>');
  li.innerHTML = `<p><code>${commit.hash.substring(0, 7)}</code> <b>${subject}</b></p>`;
  return li;
}

function getCommits() {
  return gitlogPromise(gitOptions).then((log) => {
    return log.map((commit) => {
      return {
        hash: commit.hash,
        subject: commit.subject,
        date: new Date(commit.committerDate),
      };
    });
  });
}

async function getCommitsSince(semver) {
  const commits = await getCommits();
  const versionCommit = commits.find((commit) => commit.subject === semver);
  if (!versionCommit) {
    return [];
  }

  return commits.filter(({ date }) => date > versionCommit.date);
}

function domToNode(domNode) {
  if (domNode.nodeType === domNode.TEXT_NODE) {
    return domNode.data;
  }
  if (domNode.nodeType !== domNode.ELEMENT_NODE) {
    return false;
  }
  const nodeElement = {};
  nodeElement.tag = domNode.tagName.toLowerCase();
  for (let i = 0; i < domNode.attributes.length; i++) {
    const attr = domNode.attributes[i];
    if (attr.name === 'href' || attr.name === 'src') {
      if (!nodeElement.attrs) {
        nodeElement.attrs = {};
      }
      nodeElement.attrs[attr.name] = attr.value;
    }
  }
  if (domNode.childNodes.length > 0) {
    nodeElement.children = [];
    for (let i = 0; i < domNode.childNodes.length; i++) {
      const child = domNode.childNodes[i];
      nodeElement.children.push(domToNode(child));
    }
  }
  return nodeElement;
}
