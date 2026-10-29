// Commit messages follow Conventional Commits, and each commit must explain why the change was made.
// The header says what changed; the required body says why. See CONTRIBUTING.md.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-empty': [2, 'never'],
    'body-min-length': [2, 'always', 20],
    'body-leading-blank': [2, 'always'],
    // Pull request bodies (written in the GitHub UI, or by Dependabot) are not wrapped.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
  helpUrl: 'https://www.conventionalcommits.org/en/v1.0.0/ and CONTRIBUTING.md',
};
