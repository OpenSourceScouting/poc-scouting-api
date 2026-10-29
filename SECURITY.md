# Security

This page tells you how to report a security problem and which rules protect personal data in this repository.

## Report a vulnerability

Report the problem privately with GitHub private vulnerability reporting:

1. Open the [new security advisory form](https://github.com/OpenSourceScouting/poc-scouting-api/security/advisories/new).
   You can also go to the **Security** tab and click **Report a vulnerability**.
2. Describe the problem and how to reproduce it.

Do not open a public issue. The trusted committers in `.github/CODEOWNERS` receive the report.

## Rules for personal data

The API handles personal data about adults. It does not store or answer about youth.

- Do not log personal data, for example names, in any log.
- Do not store records about youth.
- Get a review from the trusted committers for each new field that contains personal data.

For the full rules, see [API guidelines](docs/api-guidelines.md).
