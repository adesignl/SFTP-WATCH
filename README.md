# sftp-watch

A CLI tool that watches a local folder for file changes and uploads them to a remote server via SFTP. Supports manual push/pull for full or partial syncs.

## Installation

```bash
npm install -g sftp-watch
```

Or clone and link locally:

```bash
git clone https://github.com/chadpierce/sftp-watch.git
cd sftp-watch
npm install
npm link
```

## Quick Start

```bash
# Generate a config file
sftp-watch init

# Edit the config with your SFTP credentials
# (see Configuration below)

# Test the connection
sftp-watch test

# Start watching for changes
sftp-watch start
```

## Commands

### `sftp-watch start`

Watch your local directory and automatically upload files on save.

```bash
sftp-watch start
sftp-watch start -c /path/to/config.json
```

Press `Ctrl+C` to stop.

### `sftp-watch push [path]`

Upload local files to the remote server. Uploads everything by default, or specify a subfolder.

```bash
sftp-watch push                    # push all files
sftp-watch push wp-content/themes  # push only a subfolder
```

### `sftp-watch pull [path]`

Download remote files to the local directory. Downloads everything by default, or specify a subfolder.

```bash
sftp-watch pull                    # pull all files
sftp-watch pull wp-content/themes  # pull only a subfolder
```

### `sftp-watch ls [path]`

List files and folders on the remote server.

```bash
sftp-watch ls                                  # list remoteDir
sftp-watch ls /home/user/public_html/wp-content # list specific path
```

### `sftp-watch test`

Test the SFTP connection using your config.

### `sftp-watch init`

Generate a starter `sftp-watch.config.json` file in the current directory.

## Configuration

All commands accept `-c, --config <path>` to specify a config file. Defaults to `./sftp-watch.config.json`.

```json
{
  "host": "example.com",
  "port": 22,
  "username": "your-username",
  "password": "your-password",
  "privateKey": "/path/to/private/key",
  "localDir": ".",
  "remoteDir": "/home/user/public_html",
  "watch": {
    "extensions": ["php", "css", "js", "html", "json", "txt", "xml", "svg", "png", "jpg", "gif", "ico"],
    "ignore": ["node_modules", ".git", ".DS_Store", "sftp-watch.config.json"],
    "usePolling": false
  }
}
```

### Config Fields

| Field | Required | Description |
|-------|----------|-------------|
| `host` | Yes | SFTP server hostname |
| `port` | No | SFTP port (default: `22`) |
| `username` | Yes | SFTP username |
| `password` | * | Password authentication |
| `privateKey` | * | Path to SSH private key |
| `localDir` | Yes | Local directory to watch/sync (relative to config file) |
| `remoteDir` | Yes | Remote directory to sync to |

\* Either `password` or `privateKey` is required.

### Watch Options

| Field | Description |
|-------|-------------|
| `extensions` | File extensions to watch (empty array = watch all) |
| `ignore` | Files/folders to ignore |
| `usePolling` | Use polling instead of native FS events (for network drives) |

## Features

- **Watch mode** — Uses native `fs.watch` (FSEvents on macOS, ReadDirectoryChangesW on Windows) for efficient close-after-write detection
- **Push/Pull** — Manual upload and download of full projects or subfolders
- **Remote listing** — Browse remote directory contents
- **Auto-reconnect** — Automatically reconnects on SFTP disconnect
- **Retry logic** — Failed operations retry up to 3 times before erroring
- **Extension filtering** — Only watch specific file types
- **Ignore patterns** — Skip `node_modules`, `.git`, and other unwanted paths
- **Cross-platform** — Works on macOS, Windows, and Linux

## Security

Your config file contains SFTP credentials. Make sure to:

- Add `sftp-watch.config.json` to your `.gitignore`
- Use SSH key authentication (`privateKey`) when possible
- Set appropriate file permissions on the config file

## License

MIT - see [LICENSE](LICENSE)
