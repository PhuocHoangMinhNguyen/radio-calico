# pnpm Migration Guide

Radio Calico now uses pnpm for faster installs, better disk usage, and stricter dependency resolution.

## Quick Start

```bash
# Install pnpm (choose one)
npm install -g pnpm                    # Via npm
corepack enable && corepack prepare pnpm@9.15.4 --activate  # Via Corepack (recommended)
winget install pnpm                    # Windows
brew install pnpm                      # macOS

# Setup project
rm -rf node_modules package-lock.json  # Clean old npm files
pnpm install                           # Install with pnpm
pnpm run dev                           # Start development
```

## Command Reference

| npm | pnpm | Notes |
|-----|------|-------|
| `npm install` | `pnpm install` | Install all |
| `npm ci` | `pnpm install --frozen-lockfile` | CI install |
| `npm install <pkg>` | `pnpm add <pkg>` | Add dependency |
| `npm run <script>` | `pnpm <script>` | Run script (shorthand works) |
| `npm audit` | `pnpm audit` | Security audit |

## Benefits

- ⚡ **50% faster** installations
- 💾 **70% less** disk space
- 🔒 **No phantom** dependencies
- 🚀 **Better CI** caching

## Troubleshooting

**"Cannot find module"**
```bash
rm -rf node_modules && pnpm install
```

**"Different lockfile version"**
```bash
corepack prepare pnpm@9.15.4 --activate
```

**Peer dependency warnings**
- Informational only, safe to ignore if app runs

## Resources

- [pnpm docs](https://pnpm.io/)
- [Command reference](https://pnpm.io/cli/add)
