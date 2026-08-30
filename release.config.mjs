// The ONLY semantic-release config. There was previously also a
// .releaserc.json, which silently won — semantic-release resolves
// .releaserc.json before release.config.mjs and stops at the first hit — so
// edits here did nothing. Do not reintroduce a second config file.
export default {
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', {
      // Renovate is the main source of commits here, and every Renovate PR is
      // a dependency bump, so the release decision comes down to whether the
      // bump reaches the shipped backend/frontend images.
      releaseRules: [
        // Ships inside the images (backend/, frontend/, Dockerfiles) — a new
        // version is warranted because the built artifact really does change.
        { type: 'chore', scope: 'deps', release: 'patch' },
        // Does NOT ship: GitHub Actions, pre-commit, root commitlint deps.
        // renovate.json tags those `ci(deps)`. `ci` wouldn't release under the
        // default angular preset anyway, but it's spelled out so a future
        // preset change can't quietly start cutting a release (and a Docker +
        // APK build) for an actions bump that changes nothing users can run.
        { type: 'ci', release: false },
      ],
    }],
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    ['@semantic-release/git', {
      assets: ['CHANGELOG.md'],
      message: 'chore(release): ${nextRelease.version} [skip ci]',
    }],
    '@semantic-release/github',
  ],
}
