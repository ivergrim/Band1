// Builds the site during dependency installation, but only on a build server.
//
// Why this exists: the Cloudflare Worker deploys with `npx wrangler deploy`, which
// uploads whatever is in ./dist. dist/ is generated and not committed, so something
// has to build it first. The tidy way is to set the Worker's build command to
// `npm run build` in the dashboard; this script means the deploy also works if that
// field is left empty, because npm runs postinstall after installing dependencies.
//
// It is gated on CI environment variables so a local `npm install` stays fast and
// never fails because of a typecheck error in code you were about to fix.

import { execSync } from 'node:child_process';

const onBuildServer =
  process.env.WORKERS_CI || // Cloudflare Workers Builds
  process.env.CF_PAGES || // Cloudflare Pages
  process.env.CI; // anything else that says so

if (!onBuildServer) {
  process.exit(0);
}

console.log('[ci-build] build server detected, building dist/');
execSync('npm run build', { stdio: 'inherit' });
