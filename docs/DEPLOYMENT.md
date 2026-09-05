# Deployment guide

This repository has two separate release paths.

| What changes | Where it goes | How it is released |
| --- | --- | --- |
| `plugins/birdseye/` and `.claude-plugin/marketplace.json` | Claude Code plugin marketplace | Push a signed commit to GitHub `main`. |
| `site/` | `birdseye.tamal.me` | Build and deploy from `site/` with Vercel CLI. |

The generated root `birdseye/` folder is not a release input.
It is intentionally ignored and must not be committed or deployed.

## What was used for the current production release

The current production path was verified on 5 September 2026.

1. Build the site from `site/` with `npm run build`.
2. Push the signed source commit to GitHub `main`.
3. From `site/`, run `vercel deploy --prod --yes`.
4. Vercel builds the Next.js site remotely and aliases the ready release to `https://birdseye.tamal.me`.
5. Inspect the deployment and check that the public address responds successfully.

Do not assume a GitHub push deploys the marketing site.
There is no deployment workflow in this repository, and the safe, verified route is the explicit Vercel command below.

## Vercel project facts

- Project: `birdseye` in Tamal Das' Vercel projects.
- Framework: Next.js.
- Node.js: 24.x on Vercel.
- Build command: `npm run build`.
- Production address: `https://birdseye.tamal.me`.
- Local Vercel link: `site/.vercel/project.json`.

Vercel currently reports the project's root directory as `.`.
Because this repository's web app lives in `site/`, always run Vercel commands from that folder.
This makes the deployment input unambiguous even if Vercel's Git integration changes later.

`NEXT_PUBLIC_SITE_URL` is read by metadata, robots, and the sitemap.
The current Vercel project has no environment variables configured, so add it in Vercel before relying on a canonical production URL:

```bash
cd site
vercel env add NEXT_PUBLIC_SITE_URL production
```

Enter `https://birdseye.tamal.me` when Vercel asks for the value.
Never put secrets or environment values in this repository.

## Normal production release

Run this from the repository root after reviewing the change:

```bash
git status --short
cd site
npm run build
cd ..
git add <reviewed files>
git commit -S -m "Describe the release"
git push origin main
cd site
vercel whoami
vercel deploy --prod --yes
```

The last command prints a unique deployment address and aliases it to production when successful.
Save that address with the release notes or pull request.

Before committing, confirm Git signing is configured for the repository identity.
This repository expects `commit.gpgsign`, `user.signingkey`, and `gpg.format` to be set.

## Check a release

Replace `<deployment-url>` with the address printed by Vercel.

```bash
cd site
vercel inspect <deployment-url>
curl --fail --silent --show-error --location --output /dev/null --write-out 'birdseye.tamal.me HTTP %{http_code}\n' https://birdseye.tamal.me
```

Success needs both a Vercel status of `Ready` and an HTTP 200 from the production address.
The HTTP check confirms the alias resolves, but it does not replace a visual check when a page design changed.

To list recent releases:

```bash
cd site
vercel ls birdseye
```

## Preview release

Use a preview when you need a reviewable site before production:

```bash
cd site
npm run build
vercel deploy --yes
```

Vercel prints a unique preview address.
Only promote or redeploy to production after the preview has been checked.

## Roll back

Find a previously ready production address with `vercel ls birdseye`.
Then point production back to it:

```bash
cd site
vercel rollback <deployment-url> --yes
```

Verify the rollback with `vercel inspect <deployment-url>` and the production HTTP check above.
Rollback changes the live Vercel alias only.
It does not revert GitHub, so follow with a separate signed revert commit if the source must also be corrected.

## Plugin marketplace release

The plugin is not hosted on Vercel.
Its release is the signed `main` branch on GitHub:

```bash
git push origin main
```

People who already installed the marketplace need to refresh and reinstall it in Claude Code:

```text
/plugin marketplace update birdseye-marketplace
/plugin install birdseye@birdseye-marketplace
```

No npm publish, container release, or second hosting provider exists in this repository.
