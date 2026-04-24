# Project Context

## Overview

- "Ledger Wallet" (formerly "ledger-live") is a crypto wallet
- This pnpm and nx monorepo provides frontend apps

## Common Commands

- Use pnpm commands for build, dev, linting and testing.
- See [/docs/common-commands.md](/docs/common-commands.md)

## Validate Before Finishing

- Before finishing any agentic code change, run static checks for the affected scope
- See [/docs/dev/validate-before-finishing.md](/docs/dev/validate-before-finishing.md)

## Module Boundaries

- `domain/`, `shared/`, `features/` form a layered dep graph enforced by `pnpm lint:boundaries` (CI-blocking)
- Rules: `scope:shared` is leaf; `scope:domain` may depend on shared; `scope:features` may depend on domain + shared; `type:domain-entity` must not import `type:domain-api`
- Tags are inferred automatically from the folder layout — no manual `project.json` tag needed when adding a package under `domain/entity/`, `domain/api/`, `shared/`, or `features/`
- Tag rules live in `tools/nx-plugins/project-tags/plugin.js`; constraints in `tools/nx-plugins/enforce-boundaries/constraints.js`
- Legacy `libs/`, `apps/`, `e2e/`, `tools/` stay unconstrained during the migration
