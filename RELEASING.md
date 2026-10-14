# Releasing Home Cards

## Each release

1. Update `version` in `manifest.json` and `package.json` to the same value, and add it to `versions.json` with the release's `minAppVersion`. The test suite fails if the three disagree.
2. Run `npm run build` and `npm test`. The build runs Obsidian's review rules over the whole repository and must finish with no errors and no warnings.
3. Commit, then tag the commit with the bare version, with no `v` prefix: `git tag 1.29.0`.
4. Push the commit and the tag, and create a GitHub release for the tag. Attach `main.js`, `manifest.json` and `styles.css` as release assets.
5. The community directory scans each new release within minutes. A release that fails the scan drops out of search until a fixed release replaces it.

`versions.json` lists only versions that exist as GitHub releases. Obsidian reads it to offer an older release to an app too old for the newest one, and a version with no release behind it would fail to install.

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
- **Code:** `eslint.config.mjs` applies `eslint-plugin-obsidianmd`'s recommended rules to every file. Node's modules load only on the desktop, behind `Platform.isDesktop` (`src/platform/shortcuts.ts`), so `isDesktopOnly` stays `false`.
- **Disclosures:** the README's "Privacy and access" section covers the one option that works with files outside the vault. The plugin makes no network requests, shows no ads, collects no telemetry and needs no account.
- **License:** MIT, in `LICENSE`. The background tiles in `assets/tiles/` were generated with ChatGPT for this project; OpenAI's terms of use assign the rights in generated output to the user, so the tiles ship under the same license.
