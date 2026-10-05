# Publishing to npm

`.github/workflows/release.yml` publishes `@chio-protocol/claude-code-plugin`
with npm trusted publishing: its publish job exchanges its GitHub OIDC identity
for a short-lived publish token, so no npm token is stored anywhere. npm accepts
a trusted publisher only for a package that already exists, so the first version
is published once by hand. Every check in
[release qualification](RELEASE-QUALIFICATION.md) still applies.

## The publication gate comes first

A tag build refuses to publish until `node scripts/verify-native-qualification.mjs`
passes. That script reads the current candidate record and requires production
qualification: every live gate qualified, the pinned host unchanged and every
delivered file matching the record. The `0.4.0-rc.5` record is fixture-level
only, so the script refuses today.

The hand bootstrap below is held to the same rule. Run the script on the release
commit before step 3, and publish only if it exits 0. Changing what may be
published, for example a labeled prerelease before live qualification, is a
policy decision for a reviewed commit to the script and this page. Skipping the
check is never the way to make it.

## One-time bootstrap

You need an npm account that can publish to the `@chio-protocol` scope, with
two-factor authentication enabled, plus the GitHub CLI and
[`slsa-verifier`](https://github.com/slsa-framework/slsa-verifier).

1. **Qualify the release commit.** With CI green for that commit on `main`, run
   the release workflow by hand. A manual run builds, tests, qualifies the
   documented install, packs and records SLSA provenance. It never publishes.

   ```sh
   gh workflow run release.yml --repo backbay-labs/chio-claude-code-plugin --ref main
   gh run list --repo backbay-labs/chio-claude-code-plugin --workflow release.yml --limit 1
   ```

2. **Download and verify the qualified archive.** Use the run ID from the
   previous command once the run has succeeded. `VERSION` is the package version.

   ```sh
   gh run download RUN_ID --repo backbay-labs/chio-claude-code-plugin --name qualified-package --dir release
   gh run download RUN_ID --repo backbay-labs/chio-claude-code-plugin --name package.intoto.jsonl --dir release
   cd release
   shasum -a 256 -c SHA256SUMS
   slsa-verifier verify-artifact chio-protocol-claude-code-plugin-VERSION.tgz release-identity.json \
     --provenance-path package.intoto.jsonl \
     --source-uri github.com/backbay-labs/chio-claude-code-plugin --source-branch main
   cat release-identity.json
   ```

   `SHA256SUMS` is the workflow's record of the archive digest, and the signed
   provenance binds that digest to this repository and run. Confirm that
   `release-identity.json` names the commit you intend to release, package
   `@chio-protocol/claude-code-plugin` and the version you expect. Then confirm
   the publication gate on that commit:

   ```sh
   git checkout SOURCE_COMMIT
   node scripts/verify-native-qualification.mjs
   ```

3. **Publish that exact file once.** A prerelease version such as
   `0.4.0-rc.6` needs `--tag next`, which keeps it off `latest`. A stable
   version omits `--tag`.

   ```sh
   npm login
   npm publish chio-protocol-claude-code-plugin-VERSION.tgz --dry-run --ignore-scripts --access public --tag next
   npm publish chio-protocol-claude-code-plugin-VERSION.tgz --ignore-scripts --access public --tag next
   ```

   npm asks for a one-time password. A hand publish carries no npm provenance
   attestation; versions the workflow publishes do.

4. **Add the trusted publisher.** On npmjs.com, open the package's
   **Settings**, find **Trusted Publisher** and choose **GitHub Actions**:

   | Field | Value |
   | --- | --- |
   | Organization or user | `backbay-labs` |
   | Repository | `chio-claude-code-plugin` |
   | Workflow filename | `release.yml` |
   | Environment name | `npm` |
   | Allowed actions | `npm publish` |

   Every field is case-sensitive, and npm does not check them when you save, so
   a typo appears only as a failed publish. With npm 11.15.0 or later, the same
   setting is
   `npm trust github @chio-protocol/claude-code-plugin --file release.yml --repository backbay-labs/chio-claude-code-plugin --environment npm --allow-publish`.

5. **Close the token path.** Set **Settings**, **Publishing access** to "Require
   two-factor authentication and disallow tokens", then revoke automation
   tokens you no longer need. Trusted publishing keeps working. Run
   `npm logout` when done.

6. **Create the `npm` environment.** In the GitHub repository, open
   **Settings**, **Environments** and add an environment named `npm`. Add
   required reviewers there if each release should wait for your approval.
   Tag builds refuse to publish until this environment exists.

Do not push a tag for the version published by hand: that version exists, so
the run's publish step would fail. Tag-driven releases start with the next
version.

## Every later release

1. Raise the version in a reviewed commit on `main`: `package.json`,
   `package-lock.json`, `.claude-plugin/plugin.json` and `NATIVE_MOD_VERSION`
   in `scripts/mod-profile.mjs` (`test/version.test.mjs` holds them together).
   Record the candidate with `scripts/acceptance/record-native-acceptance.mjs`
   and point `CANDIDATE_RECORD` at the new record. Wait for the commit's `ci`
   push run to succeed.
2. Tag that commit and push the tag:

   ```sh
   git tag -a vVERSION -m vVERSION
   git push origin vVERSION
   ```

3. Approve the run's `npm` environment deployment when GitHub asks for it. The
   workflow refuses a tag that does not match the package version, a commit
   outside `main` or without successful CI, a candidate record without live
   qualification, or an archive whose identity differs. It then publishes the
   qualified tarball with provenance, `next` for a prerelease and `latest`
   otherwise, and attaches it to a GitHub Release.

## Requirements checked

Checked on 2026-10-05 against npm's
[trusted publishing guide](https://docs.npmjs.com/trusted-publishers) and
[`npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust):

- npm CLI 11.5.1 or later and Node 22.14.0 or later. The publish job pins npm
  11.8.0 on Node 22.19.0.
- A GitHub-hosted runner and `id-token: write`, which the publish job has.
- `repository.url` in `package.json` must match the GitHub repository exactly.
- npm tries OIDC before any token, so `NODE_AUTH_TOKEN` is not needed.
- `npm trust` requires the package to exist on the registry already, which is
  why the bootstrap above is needed.
