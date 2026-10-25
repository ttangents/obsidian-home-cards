# Releasing Home Cards

## Each release

1. Update `version` in `manifest.json` and `package.json` to the same value, and add it to `versions.json` with the release's `minAppVersion`. The test suite fails if the three disagree.
2. Add the release's notes at the top of `RELEASE_NOTES` in `src/settings/release-notes.ts`: the version, the date, a one-sentence headline for the home page's notice, and the items under New, Improved, Changed and Fixed. Set `announce: false` for a release of small fixes, which then shows its notes in the What's new window without a notice. The test suite fails if the newest notes do not match the manifest, or if a version in `versions.json` has none.
3. Run `npm run build` and `npm test`. The build runs Obsidian's review rules over the whole repository and must finish with no errors and no warnings. Commit `styles.css` with the change: the release workflow fails if its own build of the stylesheet differs. `main.js` stays out of the repository; the workflow builds it.
4. Commit, then tag the commit with the bare version, with no `v` prefix: `git tag -a 1.34.1 -m 1.34.1`.
5. Push the commit and the tag. The workflow in `.github/workflows/release.yml` checks that the tag names the manifest's version, builds and tests the plugin, attests `main.js`, `manifest.json` and `styles.css` with GitHub artifact attestations, and drafts a GitHub release with those three files and the release's notes from `release-notes.ts` (`scripts/release-notes.mjs` turns them into Markdown).
6. Open the draft under Releases, read it, and publish it. Leave the attached files as they are: an attestation matches only the exact file the workflow built.
7. The community directory scans each new release within minutes. A release that fails the scan drops out of search until a fixed release replaces it.

`versions.json` lists only versions that exist as GitHub releases. Obsidian reads it to offer an older release to an app too old for the newest one, and a version with no release behind it would fail to install.

## Review notes

The review's "Vault enumeration" recommendation needs no change: Home Cards lists the vault's notes to build its sections.

## First submission

The community directory at [community.obsidian.md](https://community.obsidian.md) takes submissions from the owner of a public GitHub repository.

1. Create the public repository `ttangents/obsidian-home-cards`, push `main` and the `1.29.0` tag, and publish the `1.29.0` release with its three assets.
2. Sign in to community.obsidian.md with your Obsidian account, connect GitHub, and choose the repository.
3. Run a preview scan of the `1.29.0` tag from the dashboard and read its results.
4. Submit, agreeing to the Developer Policies. Choose **Free** as the payment label.

The directory reads the listing from the repository: the name, author and description from `manifest.json`, and the page from `README.md`.

| Field | Value |
| --- | --- |
| ID | `home-cards` |
| Name | Home Cards |
| Author | Les Joseph |
| Description | Show a start page of note cards, in sections drawn from recent activity, properties, tags and links, styled by your active theme. |
| Repository | `ttangents/obsidian-home-cards` |
| Payment | Free |

### What the directory checks, and where this repository answers it

- **Manifest:** `id`, `name` and `description` avoid "Obsidian" and "plugin"; the description starts with a verb, ends with a period and stays under 250 characters; `minAppVersion` is the oldest version the plugin runs on (1.13.1, for the settings definitions API). `test/architecture.test.ts` checks the format.
- **Code:** `eslint.config.mjs` applies `eslint-plugin-obsidianmd`'s recommended rules to every file. The plugin uses only Obsidian's API, no Node.js modules, so `isDesktopOnly` stays `false`.
- **Disclosures:** the README's "Privacy and access" section states what the plugin reads and stores. The plugin makes no network requests, works with no files outside the vault, shows no ads, collects no telemetry and needs no account.
- **License:** MIT, in `LICENSE`. The background tiles in `assets/tiles/` were generated with ChatGPT for this project; OpenAI's terms of use assign the rights in generated output to the user, so the tiles ship under the same license.
