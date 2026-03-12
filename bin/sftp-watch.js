#!/usr/bin/env node

const { Command } = require("commander");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { loadConfig, generateDefaultConfig } = require("../lib/config");
const Uploader = require("../lib/uploader");
const { startWatcher } = require("../lib/watcher");

const program = new Command();

program
  .name("sftp-watch")
  .description("Watch a local folder and upload changes via SFTP")
  .version("1.0.0");

program
  .command("start", { isDefault: true })
  .description("Start watching for changes and uploading via SFTP")
  .option(
    "-c, --config <path>",
    "Path to config file",
    "./sftp-watch.config.json"
  )
  .action(async (opts) => {
    try {
      const config = loadConfig(opts.config);
      const uploader = new Uploader(config);

      console.log(chalk.bold("\nsftp-watch"));
      console.log(chalk.gray("─".repeat(40)));

      await uploader.connect();
      const watcher = startWatcher(config, uploader);

      const shutdown = async () => {
        console.log(chalk.yellow("\nShutting down..."));
        await watcher.close();
        await uploader.disconnect();
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Generate a starter config file")
  .option(
    "-c, --config <path>",
    "Path to write config file",
    "./sftp-watch.config.json"
  )
  .action((opts) => {
    const configPath = path.resolve(opts.config);

    if (fs.existsSync(configPath)) {
      console.error(chalk.red(`Config file already exists: ${configPath}`));
      process.exit(1);
    }

    fs.writeFileSync(configPath, generateDefaultConfig(), "utf-8");
    console.log(chalk.green(`Config file created: ${configPath}`));
    console.log(chalk.gray("Edit the file with your SFTP credentials."));
  });

program
  .command("test")
  .description("Test the SFTP connection")
  .option(
    "-c, --config <path>",
    "Path to config file",
    "./sftp-watch.config.json"
  )
  .action(async (opts) => {
    try {
      const config = loadConfig(opts.config);
      const uploader = new Uploader(config);

      console.log(
        chalk.gray(
          `Testing connection to ${config.host}:${config.port}...`
        )
      );

      const success = await uploader.testConnection();
      process.exit(success ? 0 : 1);
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("push")
  .description("Upload local files to the remote server")
  .argument("[path]", "Subfolder to push (defaults to entire localDir)")
  .option(
    "-c, --config <path>",
    "Path to config file",
    "./sftp-watch.config.json"
  )
  .action(async (subPath, opts) => {
    try {
      const config = loadConfig(opts.config);
      const uploader = new Uploader(config);
      await uploader.pushAll(subPath);
      await uploader.disconnect();
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("pull")
  .description("Download remote files to the local directory")
  .argument("[path]", "Subfolder to pull (defaults to entire remoteDir)")
  .option(
    "-c, --config <path>",
    "Path to config file",
    "./sftp-watch.config.json"
  )
  .action(async (subPath, opts) => {
    try {
      const config = loadConfig(opts.config);
      const uploader = new Uploader(config);
      await uploader.pullAll(subPath);
      await uploader.disconnect();
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("ls")
  .description("List files and folders on the remote server")
  .argument("[path]", "Remote path to list (defaults to remoteDir from config)")
  .option(
    "-c, --config <path>",
    "Path to config file",
    "./sftp-watch.config.json"
  )
  .action(async (remotePath, opts) => {
    try {
      const config = loadConfig(opts.config);
      const uploader = new Uploader(config);
      const target = remotePath || config.remoteDir;

      await uploader.listRemote(target);
      await uploader.disconnect();
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
