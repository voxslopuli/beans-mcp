# Getting Started

## Requirements

- Node.js 18+
- pnpm 10+
- [Beans CLI](https://github.com/hmans/beans) — bundled via platform-specific `@voxslopuli/beans-cli-*` optional dependencies, or available in `PATH` (or provide `--cli-path`)

## Run the server

```bash
npx @voxslopuli/beans-mcp /path/to/workspace
```

Or with explicit flags:

```bash
npx @voxslopuli/beans-mcp --workspace-root /path/to/workspace --cli-path beans --port 39173
```

## CLI arguments

- `workspace-root` (positional) or `--workspace-root` / `--workspace`
- `--cli-path <path>`
- `--port <number>`
- `--log-dir <path>`
- `-h, --help`

## Workspace resolution order

1. Explicit CLI workspace argument
2. MCP roots from connected client
3. Current working directory

## First commands to run from your MCP client

1. `beans_init` (optional, if workspace not initialized)
2. `beans_query` with `operation: refresh`
3. `beans_view` on specific IDs
