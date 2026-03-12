const SftpClient = require("ssh2-sftp-client");
const path = require("path");
const fs = require("fs");
const chalk = require("chalk");
const { getSftpOptions } = require("./config");

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

class Uploader {
  constructor(config) {
    this.config = config;
    this.sftp = new SftpClient();
    this.connected = false;
    this.connecting = false;
  }

  async _retry(fn, label) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          console.log(
            chalk.yellow(
              `${label} failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message}. Retrying...`
            )
          );
          this.connected = false;
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
          await this.connect();
        } else {
          throw err;
        }
      }
    }
  }

  async connect() {
    if (this.connected || this.connecting) return;
    this.connecting = true;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const opts = getSftpOptions(this.config);
        this.sftp = new SftpClient();
        await this.sftp.connect(opts);
        this.connected = true;
        console.log(
          chalk.green(`Connected to ${this.config.host}:${this.config.port}`)
        );
        this.connecting = false;
        return;
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          console.log(
            chalk.yellow(
              `Connection failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message}. Retrying...`
            )
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
        } else {
          this.connected = false;
          this.connecting = false;
          throw new Error(`SFTP connection failed after ${MAX_RETRIES} attempts: ${err.message}`);
        }
      }
    }
  }

  async ensureConnected() {
    if (!this.connected) {
      await this.connect();
    }
  }

  async upload(localPath) {
    const relativePath = path.relative(this.config.localDir, localPath);
    const remotePath = path
      .join(this.config.remoteDir, relativePath)
      .replace(/\\/g, "/");
    const remoteDirectory = path.dirname(remotePath).replace(/\\/g, "/");

    try {
      await this._retry(async () => {
        await this.ensureConnected();
        await this.sftp.mkdir(remoteDirectory, true);
        await this.sftp.put(localPath, remotePath);
      }, `Upload ${relativePath}`);

      const timestamp = new Date().toLocaleTimeString();
      console.log(
        chalk.gray(`[${timestamp}]`),
        chalk.cyan("uploaded"),
        chalk.white(relativePath),
        chalk.gray("→"),
        chalk.white(remotePath)
      );
    } catch (err) {
      console.error(
        chalk.red(`Failed to upload ${relativePath} after ${MAX_RETRIES} attempts: ${err.message}`)
      );
    }
  }

  async delete(localPath) {
    const relativePath = path.relative(this.config.localDir, localPath);
    const remotePath = path
      .join(this.config.remoteDir, relativePath)
      .replace(/\\/g, "/");

    try {
      await this._retry(async () => {
        await this.ensureConnected();
        await this.sftp.delete(remotePath);
      }, `Delete ${relativePath}`);

      const timestamp = new Date().toLocaleTimeString();
      console.log(
        chalk.gray(`[${timestamp}]`),
        chalk.red("deleted"),
        chalk.white(relativePath)
      );
    } catch (err) {
      // File may not exist on remote, that's ok
    }
  }

  async listRemote(remotePath) {
    await this.ensureConnected();

    const items = await this.sftp.list(remotePath);

    items.sort((a, b) => {
      if (a.type === "d" && b.type !== "d") return -1;
      if (a.type !== "d" && b.type === "d") return 1;
      return a.name.localeCompare(b.name);
    });

    for (const item of items) {
      const isDir = item.type === "d";
      const size = isDir ? "" : formatSize(item.size);
      const modified = new Date(item.modifyTime).toLocaleDateString();
      const name = isDir
        ? chalk.blue.bold(item.name + "/")
        : chalk.white(item.name);

      console.log(
        chalk.gray(modified.padEnd(12)),
        chalk.gray(size.padStart(10)),
        name
      );
    }

    console.log(chalk.gray(`\n${items.length} items in ${remotePath}`));
  }

  async pushAll(subPath) {
    await this.ensureConnected();

    const localBase = subPath
      ? path.join(this.config.localDir, subPath)
      : this.config.localDir;

    if (!fs.existsSync(localBase)) {
      throw new Error(`Path does not exist: ${localBase}`);
    }

    const files = this._getLocalFiles(localBase);
    console.log(chalk.cyan(`Pushing ${files.length} files...`));

    let uploaded = 0;
    for (const filePath of files) {
      await this.upload(filePath);
      uploaded++;
    }

    console.log(chalk.green(`\nPush complete: ${uploaded} files uploaded`));
  }

  _getLocalFiles(dir) {
    const results = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    const ignoreList = this.config.watch.ignore || [];

    for (const item of items) {
      if (ignoreList.includes(item.name)) continue;

      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results.push(...this._getLocalFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }

  async pullAll(subPath) {
    await this.ensureConnected();

    const remoteBase = subPath
      ? path.join(this.config.remoteDir, subPath).replace(/\\/g, "/")
      : this.config.remoteDir;

    const files = await this._getRemoteFiles(remoteBase);
    console.log(chalk.cyan(`Pulling ${files.length} files...`));

    let downloaded = 0;
    for (const remotePath of files) {
      const relativePath = remotePath
        .replace(this.config.remoteDir, "")
        .replace(/^\//, "");
      const localPath = path.join(this.config.localDir, relativePath);
      const localDir = path.dirname(localPath);

      fs.mkdirSync(localDir, { recursive: true });
      await this.sftp.get(remotePath, localPath);

      const timestamp = new Date().toLocaleTimeString();
      console.log(
        chalk.gray(`[${timestamp}]`),
        chalk.magenta("pulled"),
        chalk.white(relativePath)
      );
      downloaded++;
    }

    console.log(chalk.green(`\nPull complete: ${downloaded} files downloaded`));
  }

  async _getRemoteFiles(dir) {
    const results = [];
    const items = await this.sftp.list(dir);
    const ignoreList = this.config.watch.ignore || [];

    for (const item of items) {
      if (ignoreList.includes(item.name)) continue;

      const fullPath = `${dir}/${item.name}`;
      if (item.type === "d") {
        results.push(...(await this._getRemoteFiles(fullPath)));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }

  async testConnection() {
    try {
      await this.connect();
      const list = await this.sftp.list(this.config.remoteDir);
      console.log(
        chalk.green(`Remote directory "${this.config.remoteDir}" accessible.`),
        chalk.gray(`(${list.length} items)`)
      );
      await this.disconnect();
      return true;
    } catch (err) {
      console.error(chalk.red(`Connection test failed: ${err.message}`));
      await this.disconnect();
      return false;
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.sftp.end();
      this.connected = false;
    }
  }
}

function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + units[i];
}

module.exports = Uploader;
