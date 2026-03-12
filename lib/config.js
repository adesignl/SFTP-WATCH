const fs = require("fs");
const path = require("path");

const REQUIRED_FIELDS = ["host", "username", "localDir", "remoteDir"];

const DEFAULT_CONFIG = {
  port: 22,
  watch: {
    ignore: ["node_modules", ".git", ".DS_Store"],
    usePolling: false,
  },
};

function loadConfig(configPath) {
  const resolved = path.resolve(configPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${resolved}`);
  }

  const config = {
    ...DEFAULT_CONFIG,
    ...parsed,
    watch: { ...DEFAULT_CONFIG.watch, ...parsed.watch },
  };

  for (const field of REQUIRED_FIELDS) {
    if (!config[field]) {
      throw new Error(`Missing required config field: "${field}"`);
    }
  }

  if (!config.password && !config.privateKey) {
    throw new Error(
      'Config must include either "password" or "privateKey" for authentication'
    );
  }

  config.localDir = path.resolve(path.dirname(resolved), config.localDir);

  if (!fs.existsSync(config.localDir)) {
    throw new Error(`Local directory does not exist: ${config.localDir}`);
  }

  return config;
}

function getSftpOptions(config) {
  const opts = {
    host: config.host,
    port: config.port,
    username: config.username,
  };

  if (config.privateKey) {
    const keyPath = path.resolve(config.privateKey);
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Private key not found: ${keyPath}`);
    }
    opts.privateKey = fs.readFileSync(keyPath, "utf-8");
  } else {
    opts.password = config.password;
  }

  return opts;
}

function generateDefaultConfig() {
  return JSON.stringify(
    {
      host: "example.com",
      port: 22,
      username: "your-username",
      password: "",
      privateKey: "",
      localDir: "./src",
      remoteDir: "/var/www/html",
      watch: {
        extensions: ["php", "css", "js", "html", "htm", "json", "txt", "xml", "svg", "png", "jpg", "gif", "ico"],
        ignore: ["node_modules", ".git", ".DS_Store"],
        usePolling: false,
      },
    },
    null,
    2
  );
}

module.exports = { loadConfig, getSftpOptions, generateDefaultConfig };
