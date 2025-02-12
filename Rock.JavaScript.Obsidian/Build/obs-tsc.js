// Taken from vue-tsc project so we can use custom extensions.
/* eslint-disable */
const semver = require('semver');
const fs = require('fs');
const tsPkg = require('typescript/package.json');
const readFileSync = fs.readFileSync;
const tscPath = require.resolve('typescript/lib/tsc');
const proxyApiPath = require.resolve('vue-tsc/out/index');
const { state } = require('vue-tsc/out/shared');

fs.readFileSync = (...args) => {
	if (args[0] === tscPath) {
		let tsc = readFileSync(...args);

		// add *.obs files to allow extensions
		tryReplace(/supportedTSExtensions = .*(?=;)/, s => s + '.concat([[".obs"]])');
		tryReplace(/supportedJSExtensions = .*(?=;)/, s => s + '.concat([[".obs"]])');
		tryReplace(/allSupportedExtensions = .*(?=;)/, s => s + '.concat([[".obs"]])');

		// proxy createProgram apis
		tryReplace(/function createProgram\(.+\) {/, s => s + ` return require(${JSON.stringify(proxyApiPath)}).createProgram(...arguments);`);

		// patches logic for checking root file extension in build program for incremental builds
		if (semver.gt(tsPkg.version, '5.0.0')) {
			tryReplace(
				`for (const existingRoot of buildInfoVersionMap.roots) {`,
				`for (const existingRoot of buildInfoVersionMap.roots
					.filter(file => !file.toLowerCase().includes('__vls_'))
					.map(file => file.replace(/\.obs\.(j|t)sx?$/i, '.obs'))
				) {`
			);
			tryReplace(
				`return [toFileId(key), toFileIdListId(state.exportedModulesMap.getValues(key))];`,
				`return [toFileId(key), toFileIdListId(new Set(arrayFrom(state.exportedModulesMap.getValues(key)).filter(file => file !== void 0)))];`
			);
		}
		if (semver.gte(tsPkg.version, '5.0.4')) {
			tryReplace(
				`return createBuilderProgramUsingProgramBuildInfo(buildInfo, buildInfoPath, host);`,
				s => `buildInfo.program.fileNames = buildInfo.program.fileNames
					.filter(file => !file.toLowerCase().includes('__vls_'))
					.map(file => file.replace(/\.obs\.(j|t)sx?$/i, '.obs'));\n` + s
			);
		}

		return tsc;

		function tryReplace(search, replace) {
			const before = tsc;
			tsc = tsc.replace(search, replace);
			const after = tsc;
			if (after === before) {
				throw 'Search string not found: ' + JSON.stringify(search.toString());
			}
		}
	}
	return readFileSync(...args);
};

(function main() {
	try {
		require(tscPath);
	}
	catch (err) {
		if (err === 'hook') {
			state.hook.worker.then(main);
		}
		else {
			throw err;
		}
	}
})();
