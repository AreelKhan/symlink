# Local dev set up

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | v20+ | [nvm](https://github.com/nvm-sh/nvm) or nodejs.org |
| pnpm | v10+ | `npm install -g pnpm` |
| Rust | v1.87+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Xcode CLT (macOS) | — | `xcode-select --install` |

Linux users: see [Tauri prerequisites](https://tauri.app/start/prerequisites) for additional system deps.

## Install & run

```sh
git clone <repo-url> && cd symlink
pnpm install          # deps + workspace links + git hooks (lefthook)
pnpm dev:web          # web app → http://localhost:5173
pnpm dev:desktop      # desktop app (first run compiles Rust, takes a few mins)
```

## Code quality

```sh
pnpm check            # lint + format (biome)
pnpm check:fix        # auto-fix
pnpm type-check       # tsc --noEmit across all packages
```

These run automatically via lefthook:
- **pre-commit**: `pnpm check`
- **pre-push**: `pnpm check` + `pnpm type-check`
