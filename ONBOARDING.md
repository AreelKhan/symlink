# Onboarding

## Prerequisites

Install these tools before anything else.

**Node.js** (v20+)
Use [nvm](https://github.com/nvm-sh/nvm) or download from nodejs.org.

**pnpm** (v10+)
```sh
npm install -g pnpm
```

**Rust** (v1.87+)
```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Tauri system dependencies** (macOS only — Linux has additional requirements, see [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites))
```sh
xcode-select --install
```

## Setup

```sh
git clone <repo-url>
cd symlink
pnpm install
```

`pnpm install` does three things:
1. Installs all JS dependencies across every workspace package
2. Links internal packages (`@symlink/shared`, `@symlink/ui`, etc.) so they can import each other
3. Installs git hooks (pre-commit and pre-push run `pnpm check`)

## Running the apps

**Web app**
```sh
pnpm dev:web
```
Opens at http://localhost:5173

**Desktop app** (compiles Rust on first run — takes a few minutes)
```sh
pnpm dev:desktop
```

## Code quality

```sh
pnpm check        # lint + format check
pnpm check:fix    # auto-fix formatting issues
```

Biome runs automatically on commit and push. Fix any errors before committing.
