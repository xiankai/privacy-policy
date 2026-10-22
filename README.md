# privacy-policy

Public privacy policies for my apps and integrations, served at privacy.bespectacledcyborg.com.

The policy and terms text comes from the [App Privacy Policy Generator](https://app-privacy-policy-generator.nisrulz.com/) and is hosted unchanged. Each app has a folder under `apps/<slug>/`:

- `app.json`: the generator inputs, the page title, the index listing and the "last updated" date
- `generated/privacy.html`, `generated/terms.html`: the generator's output, written by `tools/generate.mjs`
- `supplement.html` (optional): a developer-written block shown after the generated policy, for what the generator can't say (Sentry details, Google API Limited Use)

## Adding or updating an app

```sh
pnpm install
pnpm exec playwright install chromium-headless-shell
pnpm generate <slug>   # drives the generator from apps/<slug>/app.json
pnpm build             # writes /<slug>/, /<slug>/terms/ and the index
```

`generator.thirdParties` names must match the generator's list exactly; the script fails if one isn't offered. Keep `generator.effectiveDate` when regenerating an existing policy, and bump `updated` when the text changes.

GitHub Pages serves the repo root from the GitHub mirror; `_config.yml` keeps `apps/`, `tools/` and the package files off the site.
