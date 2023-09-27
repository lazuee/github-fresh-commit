import { spawn } from "child_process";
import "dotenv/config";
import http from "http";
import https from "https";
import path from "path";

const trimLeft = (value, charlist = "/") => value.replace(new RegExp(`^[${charlist}]*`), "");
const trimRight = (value, charlist = "/") => value.replace(new RegExp(`[${charlist}]*$`), "");
const trim = (value, charlist) => value && trimLeft(trimRight(value, charlist));

const token = process.env.GH_TOKEN || process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
const commitMessage = process.env.GH_COMMIT_MESSAGE || process.env.INPUT_COMMIT_MESSAGE;
const repository = trim(process.env.GH_REPOSITORY || process.env.GITHUB_REPOSITORY);
let branch = process.env.INPUT_BRANCH || "";

const get = (url, options = {}) =>
	new Promise((resolve, reject) =>
		(new URL(url).protocol === "http:" ? http : https)
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
		spawn(cmd, args, { stdio: "inherit", ...options })
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

	await exec("bash", [path.join("./run.sh")], {
		env,
	});

	console.log("[FreshCommit] Done!");
};

main();
