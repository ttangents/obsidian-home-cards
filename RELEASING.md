# Releasing Home Cards

## Each release

1. Update `version` in `manifest.json` and `package.json` to the same value, and add it to `versions.json` with the release's `minAppVersion`. The test suite fails if the three disagree.
2. Run `npm run build` and `npm test`. The build runs Obsidian's lint rules; fix every error. The known warnings concern `setDynamicTooltip` and `display()`, which the plugin keeps for Obsidian 1.10 to 1.12.
3. Commit, then tag the commit with the bare version, with no `v` prefix: `git tag 1.21.0`.
4. Push the commit and the tag, and create a GitHub release for the tag. Attach `main.js`, `manifest.json` and `styles.css` as release assets.
5. The community directory scans each release automatically. A release that fails the scan drops out of search until a fixed release replaces it.

## First submission

Submit through the community directory at community.obsidian.md, which requires a public GitHub repository. Use these values:

| Field | Value |
| --- | --- |
| ID | `home-cards` |
| Name | Home Cards |
| Author | Les Joseph |
| Description | A configurable start page for your vault, with sections of cards drawn from recency, properties, tags and links, styled by your active theme. |
| Repository | `GITHUB_USER/home-cards` |
| Payment | Free |

Before submitting, confirm that:

- the repository is public and contains `README.md`, `LICENSE` and `manifest.json` at its root;
- the latest release carries the three assets above, and its tag matches `manifest.json`;
- `manifest.json` has `authorUrl` set to the author's GitHub profile;
- the README's BRAT instructions name the real repository;
- the license terms of the image generator used for `assets/tiles/` (ChatGPT, for the 1.22 set) allow redistribution under MIT.
