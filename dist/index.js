import { createRequire as __WEBPACK_EXTERNAL_createRequire } from "module";

/******/ var __webpack_modules__ = {
	/***/ 332: /***/ (__unused_webpack_module, __unused_webpack_exports, __nccwpck_require__) => {
		(function () {
			__nccwpck_require__(668).config(
				Object.assign({}, __nccwpck_require__(276), __nccwpck_require__(721)(process.argv)),
			);
		})();

		/***/
	},

	/***/ 721: /***/ (module) => {
		const re = /^dotenv_config_(encoding|path|debug|override|DOTENV_KEY)=(.+)$/;

		module.exports = function optionMatcher(args) {
			return args.reduce(function (acc, cur) {
				const matches = cur.match(re);
				if (matches) {
					acc[matches[1]] = matches[2];
				}
				return acc;
			}, {});
		};

		/***/
	},

	/***/ 276: /***/ (module) => {
		// ../config.js accepts options via environment variables
		const options = {};

		if (process.env.DOTENV_CONFIG_ENCODING != null) {
			options.encoding = process.env.DOTENV_CONFIG_ENCODING;
		}

		if (process.env.DOTENV_CONFIG_PATH != null) {
			options.path = process.env.DOTENV_CONFIG_PATH;
		}

		if (process.env.DOTENV_CONFIG_DEBUG != null) {
			options.debug = process.env.DOTENV_CONFIG_DEBUG;
		}

		if (process.env.DOTENV_CONFIG_OVERRIDE != null) {
			options.override = process.env.DOTENV_CONFIG_OVERRIDE;
		}

		if (process.env.DOTENV_CONFIG_DOTENV_KEY != null) {
			options.DOTENV_KEY = process.env.DOTENV_CONFIG_DOTENV_KEY;
		}

		module.exports = options;

		/***/
	},

	/***/ 668: /***/ (module, __unused_webpack_exports, __nccwpck_require__) => {
		const fs = __nccwpck_require__(147);
		const path = __nccwpck_require__(17);
		const os = __nccwpck_require__(37);
		const crypto = __nccwpck_require__(113);
		const packageJson = __nccwpck_require__(595);

		const version = packageJson.version;

		const LINE =
			/(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

		// Parse src into an Object
		function parse(src) {
			const obj = {};

			// Convert buffer to string
			let lines = src.toString();

			// Convert line breaks to same format
			lines = lines.replace(/\r\n?/gm, "\n");

			let match;
			while ((match = LINE.exec(lines)) != null) {
				const key = match[1];

				// Default undefined or null to empty string
				let value = match[2] || "";

				// Remove whitespace
				value = value.trim();

				// Check if double quoted
				const maybeQuote = value[0];

				// Remove surrounding quotes
				value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");

				// Expand newlines if double quoted
				if (maybeQuote === '"') {
					value = value.replace(/\\n/g, "\n");
					value = value.replace(/\\r/g, "\r");
				}

				// Add to object
				obj[key] = value;
			}

			return obj;
		}

		function _parseVault(options) {
			const vaultPath = _vaultPath(options);

			// Parse .env.vault
			const result = DotenvModule.configDotenv({ path: vaultPath });
			if (!result.parsed) {
				throw new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
			}

			// handle scenario for comma separated keys - for use with key rotation
			// example: DOTENV_KEY="dotenv://:key_1234@dotenv.org/vault/.env.vault?environment=prod,dotenv://:key_7890@dotenv.org/vault/.env.vault?environment=prod"
			const keys = _dotenvKey(options).split(",");
			const length = keys.length;

			let decrypted;
			for (let i = 0; i < length; i++) {
				try {
					// Get full key
					const key = keys[i].trim();

					// Get instructions for decrypt
					const attrs = _instructions(result, key);

					// Decrypt
					decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);

					break;
				} catch (error) {
					// last key
					if (i + 1 >= length) {
						throw error;
					}
					// try next key
				}
			}

			// Parse decrypted .env string
			return DotenvModule.parse(decrypted);
		}

		function _log(message) {
			console.log(`[dotenv@${version}][INFO] ${message}`);
		}

		function _warn(message) {
			console.log(`[dotenv@${version}][WARN] ${message}`);
		}

		function _debug(message) {
			console.log(`[dotenv@${version}][DEBUG] ${message}`);
		}

		function _dotenvKey(options) {
			// prioritize developer directly setting options.DOTENV_KEY
			if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
				return options.DOTENV_KEY;
			}

			// secondary infra already contains a DOTENV_KEY environment variable
			if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
				return process.env.DOTENV_KEY;
			}

			// fallback to empty string
			return "";
		}

		function _instructions(result, dotenvKey) {
			// Parse DOTENV_KEY. Format is a URI
			let uri;
			try {
				uri = new URL(dotenvKey);
			} catch (error) {
				if (error.code === "ERR_INVALID_URL") {
					throw new Error(
						"INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenv.org/vault/.env.vault?environment=development",
					);
				}

				throw error;
			}

			// Get decrypt key
			const key = uri.password;
			if (!key) {
				throw new Error("INVALID_DOTENV_KEY: Missing key part");
			}

			// Get environment
			const environment = uri.searchParams.get("environment");
			if (!environment) {
				throw new Error("INVALID_DOTENV_KEY: Missing environment part");
			}

			// Get ciphertext payload
			const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
			const ciphertext = result.parsed[environmentKey]; // DOTENV_VAULT_PRODUCTION
			if (!ciphertext) {
				throw new Error(
					`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`,
				);
			}

			return { ciphertext, key };
		}

		function _vaultPath(options) {
			let dotenvPath = path.resolve(process.cwd(), ".env");

			if (options && options.path && options.path.length > 0) {
				dotenvPath = options.path;
			}

			// Locate .env.vault
			return dotenvPath.endsWith(".vault") ? dotenvPath : `${dotenvPath}.vault`;
		}

		function _resolveHome(envPath) {
			return envPath[0] === "~" ? path.join(os.homedir(), envPath.slice(1)) : envPath;
		}

		function _configVault(options) {
			_log("Loading env from encrypted .env.vault");

			const parsed = DotenvModule._parseVault(options);

			let processEnv = process.env;
			if (options && options.processEnv != null) {
				processEnv = options.processEnv;
			}

			DotenvModule.populate(processEnv, parsed, options);

			return { parsed };
		}

		function configDotenv(options) {
			let dotenvPath = path.resolve(process.cwd(), ".env");
			let encoding = "utf8";
			const debug = Boolean(options && options.debug);

			if (options) {
				if (options.path != null) {
					dotenvPath = _resolveHome(options.path);
				}
				if (options.encoding != null) {
					encoding = options.encoding;
				}
			}

			try {
				// Specifying an encoding returns a string instead of a buffer
				const parsed = DotenvModule.parse(fs.readFileSync(dotenvPath, { encoding }));

				let processEnv = process.env;
				if (options && options.processEnv != null) {
					processEnv = options.processEnv;
				}

				DotenvModule.populate(processEnv, parsed, options);

				return { parsed };
			} catch (e) {
				if (debug) {
					_debug(`Failed to load ${dotenvPath} ${e.message}`);
				}

				return { error: e };
			}
		}

		// Populates process.env from .env file
		function config(options) {
			const vaultPath = _vaultPath(options);

			// fallback to original dotenv if DOTENV_KEY is not set
			if (_dotenvKey(options).length === 0) {
				return DotenvModule.configDotenv(options);
			}

			// dotenvKey exists but .env.vault file does not exist
			if (!fs.existsSync(vaultPath)) {
				_warn(
					`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`,
				);

				return DotenvModule.configDotenv(options);
			}

			return DotenvModule._configVault(options);
		}

		function decrypt(encrypted, keyStr) {
			const key = Buffer.from(keyStr.slice(-64), "hex");
			let ciphertext = Buffer.from(encrypted, "base64");

			const nonce = ciphertext.slice(0, 12);
			const authTag = ciphertext.slice(-16);
			ciphertext = ciphertext.slice(12, -16);

			try {
				const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
				aesgcm.setAuthTag(authTag);
				return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
			} catch (error) {
				const isRange = error instanceof RangeError;
				const invalidKeyLength = error.message === "Invalid key length";
				const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";

				if (isRange || invalidKeyLength) {
					const msg = "INVALID_DOTENV_KEY: It must be 64 characters long (or more)";
					throw new Error(msg);
				} else if (decryptionFailed) {
					const msg = "DECRYPTION_FAILED: Please check your DOTENV_KEY";
					throw new Error(msg);
				} else {
					console.error("Error: ", error.code);
					console.error("Error: ", error.message);
					throw error;
				}
			}
		}

		// Populate process.env with parsed values
		function populate(processEnv, parsed, options = {}) {
			const debug = Boolean(options && options.debug);
			const override = Boolean(options && options.override);

			if (typeof parsed !== "object") {
				throw new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
			}

			// Set process.env
			for (const key of Object.keys(parsed)) {
				if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
					if (override === true) {
						processEnv[key] = parsed[key];
					}

					if (debug) {
						if (override === true) {
							_debug(`"${key}" is already defined and WAS overwritten`);
						} else {
							_debug(`"${key}" is already defined and was NOT overwritten`);
						}
					}
				} else {
					processEnv[key] = parsed[key];
				}
			}
		}

		const DotenvModule = {
			configDotenv,
			_configVault,
			_parseVault,
			config,
			decrypt,
			parse,
			populate,
		};

		module.exports.configDotenv = DotenvModule.configDotenv;
		module.exports._configVault = DotenvModule._configVault;
		module.exports._parseVault = DotenvModule._parseVault;
		module.exports.config = DotenvModule.config;
		module.exports.decrypt = DotenvModule.decrypt;
		module.exports.parse = DotenvModule.parse;
		module.exports.populate = DotenvModule.populate;

		module.exports = DotenvModule;

		/***/
	},

	/***/ 113: /***/ (module) => {
		module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("crypto");

		/***/
	},

	/***/ 147: /***/ (module) => {
		module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("fs");

		/***/
	},

	/***/ 37: /***/ (module) => {
		module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("os");

		/***/
	},

	/***/ 17: /***/ (module) => {
		module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("path");

		/***/
	},

	/***/ 595: /***/ (module) => {
		module.exports = JSON.parse(
			'{"name":"dotenv","version":"16.3.1","description":"Loads environment variables from .env file","main":"lib/main.js","types":"lib/main.d.ts","exports":{".":{"types":"./lib/main.d.ts","require":"./lib/main.js","default":"./lib/main.js"},"./config":"./config.js","./config.js":"./config.js","./lib/env-options":"./lib/env-options.js","./lib/env-options.js":"./lib/env-options.js","./lib/cli-options":"./lib/cli-options.js","./lib/cli-options.js":"./lib/cli-options.js","./package.json":"./package.json"},"scripts":{"dts-check":"tsc --project tests/types/tsconfig.json","lint":"standard","lint-readme":"standard-markdown","pretest":"npm run lint && npm run dts-check","test":"tap tests/*.js --100 -Rspec","prerelease":"npm test","release":"standard-version"},"repository":{"type":"git","url":"git://github.com/motdotla/dotenv.git"},"funding":"https://github.com/motdotla/dotenv?sponsor=1","keywords":["dotenv","env",".env","environment","variables","config","settings"],"readmeFilename":"README.md","license":"BSD-2-Clause","devDependencies":{"@definitelytyped/dtslint":"^0.0.133","@types/node":"^18.11.3","decache":"^4.6.1","sinon":"^14.0.1","standard":"^17.0.0","standard-markdown":"^7.1.0","standard-version":"^9.5.0","tap":"^16.3.0","tar":"^6.1.11","typescript":"^4.8.4"},"engines":{"node":">=12"},"browser":{"fs":false}}',
		);

		/***/
	},

	/******/
};
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/
/******/ // The require function
/******/ function __nccwpck_require__(moduleId) {
	/******/ // Check if module is in cache
	/******/ var cachedModule = __webpack_module_cache__[moduleId];
	/******/ if (cachedModule !== undefined) {
		/******/ return cachedModule.exports;
		/******/
	}
	/******/ // Create a new module (and put it into the cache)
	/******/ var module = (__webpack_module_cache__[moduleId] = {
		/******/ // no module.id needed
		/******/ // no module.loaded needed
		/******/ exports: {},
		/******/
	});
	/******/
	/******/ // Execute the module function
	/******/ var threw = true;
	/******/ try {
		/******/ __webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
		/******/ threw = false;
		/******/
	} finally {
		/******/ if (threw) delete __webpack_module_cache__[moduleId];
		/******/
	}
	/******/
	/******/ // Return the exports of the module
	/******/ return module.exports;
	/******/
}
/******/
/************************************************************************/
/******/ /* webpack/runtime/compat */
/******/
/******/ if (typeof __nccwpck_require__ !== "undefined")
	__nccwpck_require__.ab =
		new URL(".", import.meta.url).pathname.slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
	// CONCATENATED MODULE: external "child_process"
	const external_child_process_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("child_process");
	// EXTERNAL MODULE: ./node_modules/.pnpm/dotenv@16.3.1/node_modules/dotenv/config.js
	var config = __nccwpck_require__(332); // CONCATENATED MODULE: external "http"
	const external_http_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("http"); // CONCATENATED MODULE: external "https"
	const external_https_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("https");
	// EXTERNAL MODULE: external "path"
	var external_path_ = __nccwpck_require__(17); // CONCATENATED MODULE: ./index.js
	const trimLeft = (value, charlist = "/") => value.replace(new RegExp(`^[${charlist}]*`), "");
	const trimRight = (value, charlist = "/") => value.replace(new RegExp(`[${charlist}]*$`), "");
	const trim = (value, charlist) => value && trimLeft(trimRight(value, charlist));

	const token = process.env.GH_TOKEN || process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
	const commitMessage = process.env.GH_COMMIT_MESSAGE || process.env.INPUT_COMMIT_MESSAGE;
	const repository = trim(process.env.GH_REPOSITORY || process.env.GITHUB_REPOSITORY);
	let branch = process.env.INPUT_BRANCH || "";

	const get = (url, options = {}) =>
		new Promise((resolve, reject) =>
			(new URL(url).protocol === "http:" ? external_http_namespaceObject : external_https_namespaceObject)
				.get(url, options, (res) => {
					const chunks = [];
					res.on("data", (chunk) => chunks.push(chunk));
					res.on("end", () => {
						const body = Buffer.concat(chunks).toString("utf-8");
						if (res.statusCode < 200 || res.statusCode > 300) {
							return reject(
								Object.assign(new Error(`Invalid status code '${res.statusCode}' for url '${url}'`), {
									res,
									body,
								}),
							);
						}
						return resolve(body);
					});
				})
				.on("error", reject),
		);

	const exec = (cmd, args = [], options = {}) =>
		new Promise((resolve, reject) =>
			(0, external_child_process_namespaceObject.spawn)(cmd, args, { stdio: "inherit", ...options })
				.on("close", (code) => {
					if (code !== 0) {
						return reject(Object.assign(new Error(`Invalid exit code: ${code}`), { code }));
					}
					return resolve(code);
				})
				.on("error", reject),
		);

	const main = async () => {
		console.log("[FreshCommit] Running...");
		if (!branch && process.env.GITHUB_API_URL) {
			const headers = {
				"User-Agent": `github.com/${repository}`,
			};
			if (token) headers.Authorization = `token ${token}`;

			branch = JSON.parse(
				await get(`${process.env.GITHUB_API_URL}/repos/${repository}`, {
					headers,
				}),
			).default_branch;
		}

		const env = {
			...process.env,
			INPUT_GITHUB_TOKEN: token,
			INPUT_COMMIT_MESSAGE: commitMessage,
			INPUT_BRANCH: branch.replace("refs/heads/", ""),
			INPUT_REPOSITORY: repository,
		};

		await exec("bash", [external_path_.join("./run.sh")], {
			env,
		});

		console.log("[FreshCommit] Done!");
	};

	main();
})();
