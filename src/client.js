require('babel-polyfill');

import got from 'got';
import isMonth from '@splash-cli/is-month';
import parseID from '@splash-cli/parse-unsplash-id';
import chalk from 'chalk';
import Conf from 'conf';
import frun from 'first-run';
import fs from 'fs';
import randomFrom from 'lodash/sample';
import mkdirp from 'mkdirp';
import Ora from 'ora';
import { userInfo } from 'os';
import updateNotifier from 'update-notifier';
import wallpaper from 'wallpaper';
import isImage from 'is-image';

import manifest from '../package.json';
import commands from './commands/index';

import { defaultSettings as defaults } from './extra/config';
import Unsplash from './extra/Unsplash';

import { clearSettings, download, errorHandler, printBlock, pathFixer } from './extra/utils';

const config = new Conf({ defaults });

const spinner = new Ora({
	color: 'yellow',
	spinner: isMonth('december') ? 'christmas' : 'earth',
});

/**
 *
 * @param {String[]} input
 * @param {Object} flags
 */
export default async function(input, flags) {
	const [command, ...subCommands] = input;
	const options = {};

	// Parse commands
	for (let i = 0; i < subCommands.length; i += 1) {
		options[subCommands[i]] = subCommands[i];
	}

	if (flags.quiet) {
		const emptyFunction = () => null;

		console.log = console.info = emptyFunction;

		if (spinner.fail) {
			spinner.fail = emptyFunction;
		}

		if (spinner.start) {
			spinner.start = emptyFunction;
		}

		if (spinner.succeed) {
			spinner.succeed = emptyFunction;
		}
	}

	if (!config.get('directory') || !config.has('directory')) {
		config.set('directory', pathFixer('~/Pictures/splash_photos'));
	}

	if (fs.existsSync(config.get('directory'))) {
		mkdirp(config.get('directory'), (error) => {
			if (error) return errorHandler(error);
		});
	}

	if (!config.has('lastWP') || !config.get('lastWP')) {
		const lastWP = await wallpaper.get();
		config.set('lastWP', lastWP);
	}

	updateNotifier({ pkg: manifest, updateCheckInterval: 1000 * 30 }).notify();

	if (frun()) {
		await clearSettings();
		await Unsplash.shared.picOfTheDay();

		printBlock(
			chalk`Welcome to ${manifest.name}@{dim ${manifest.version}} {bold @${userInfo().username}}`,
			'',
			chalk`{dim CLI setup {green completed}!}`,
			'',
			chalk`{bold Enjoy "{yellow ${manifest.name}}" running {green splash}}`,
		);

		try {
			await got('https://analytics.splash-cli.app/api/users', {
				method: 'POST',
			});
		} catch (error) {
			errorHandler(error);
		}

		process.exit();
	} else if (!config.has('pic-of-the-day') || !config.get('pic-of-the-day').date.delay) {
		await Unsplash.shared.picOfTheDay();
	}

	if (!command) {
		console.clear();
		if (!flags.me && !flags.updateMe && !flags.set) spinner.start('Connecting to Unsplash');

		if (flags.set) {
			const filePath = pathFixer(flags.set);

			if (fs.existsSync(filePath) && isImage(filePath)) {
				let options = {};

				if (flags.scale) options.scale = flags.scale;
				if (flags.screen) options.screen = flags.screen;

				wallpaper.set(filePath, options);

				return printBlock('Wallpaper updated!');
			}

			return errorHandler('File not found.');
		}

		try {
			let photo = false;

			// here you can add your own custom flags
			if (flags.day) {
				photo = await Unsplash.shared.picOfTheDay();
			} else if (flags.curated) {
				const response = await Unsplash.shared.getRandomPhoto({ collection: 317099 });
				const photos = await response.json();

				photo = randomFrom(photos);
			} else if (flags.id && parseID(flags.id)) {
				photo = await Unsplash.shared.getPhoto(parseID(flags.id));
			} else {
				if (flags.id) spinner.warn = chalk`Invalid ID: "{yellow ${flags.id}}"`;

				photo = await Unsplash.shared.getRandomPhoto({
					query: flags.query,
					username: flags.user,
					featured: Boolean(flags.featured),
					collection: flags.collection,
				});
			}

			if (photo) {
				spinner.succeed('Connected!');

				if (Array.isArray(photo)) {
					photo = photo[0];
				}

				if (photo.errors) {
					return printBlock(chalk`{bold {red ERROR:}}`, ...photo.errors);
				}

				const { url } = await Unsplash.shared.getDownloadLink(photo.id);

				await download(photo, url, flags, true);
			} else {
				spinner.fail('Unable to connect.');
			}
		} catch (error) {
			spinner.fail();
			return errorHandler(error);
		}
	} else {
		console.clear();

		switch (command) {
		case 'collection':
		case 'collections':
			commands.collection(subCommands);
			break;
		case 'settings':
		case 'config':
			commands.settings(subCommands);
			break;
		case 'alias':
		case 'aliases':
			commands.alias(subCommands);
			break;
		case 'user':
			commands.user(subCommands);
			break;
		case 'directory':
		case 'dir':
			commands.dir(subCommands);
			break;
		default:
			printBlock(
				chalk`{bold {red Error}}: "{yellow ${command}}" is not a {dim splash} command.`,
				'',
				chalk`See {dim splash --help}`,
			);
			break;
		}
	}
}
