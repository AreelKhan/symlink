# Decision Log

| # | Decision | Why | Date |
|---|----------|-----|------|
| 1 | Web client is online-only (no offline/PWA support) | Reduces scope significantly — no service worker, no OPFS, no wa-sqlite needed for web. Desktop/mobile (Tauri) handle offline natively. Can add PWA capabilities later without major refactoring since projection logic lives in `packages/shared` as TypeScript. | 2026-03-29 |
