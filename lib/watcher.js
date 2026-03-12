const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

function startWatcher(config, uploader) {
  const extensions = config.watch.extensions || [];
  const ignoreList = config.watch.ignore || [];
  const debounceMs = 500;
  const pending = new Map();

  const shouldIgnore = (filePath) => {
    const parts = filePath.split(path.sep);
    return parts.some((part) => ignoreList.includes(part));
  };

  const shouldHandle = (filePath) => {
    if (extensions.length === 0) return true;
    const ext = path.extname(filePath).toLowerCase().replace(".", "");
    return extensions.includes(ext);
  };

  const handleChange = (filePath) => {
    if (shouldIgnore(filePath) || !shouldHandle(filePath)) return;

    // Debounce: editors often write multiple times on save
    if (pending.has(filePath)) {
      clearTimeout(pending.get(filePath));
    }

    pending.set(
      filePath,
      setTimeout(() => {
        pending.delete(filePath);
        const absolutePath = path.join(config.localDir, filePath);

        if (fs.existsSync(absolutePath)) {
          uploader.upload(absolutePath);
        } else {
          uploader.delete(absolutePath);
        }
      }, debounceMs)
    );
  };

  const watcher = fs.watch(
    config.localDir,
    { recursive: true },
    (eventType, filename) => {
      if (!filename) return;
      handleChange(filename);
    }
  );

  watcher.on("error", (err) => {
    if (
      err.code === "EACCES" ||
      err.code === "EPERM" ||
      err.code === "EAGAIN" ||
      err.code === "EBUSY" ||
      err.code === "EBADF"
    ) {
      return;
    }
    console.error(chalk.red(`Watcher error: ${err.message}`));
  });

  console.log(chalk.green("Watching for changes..."));
  console.log(chalk.gray(`  Local:  ${config.localDir}`));
  console.log(chalk.gray(`  Remote: ${config.remoteDir}`));
  console.log(chalk.gray(`  Ignore: ${ignoreList.join(", ")}`));
  if (extensions.length) {
    console.log(chalk.gray(`  Extensions: ${extensions.join(", ")}`));
  }
  console.log();

  return watcher;
}

module.exports = { startWatcher };
