require('babel-polyfill');
require("regenerator-runtime");

import https from 'https';
import fs from 'fs';
import path from 'path';

import mkdirp from 'mkdirp';
import wallpaper from 'wallpaper';
import chalk from 'chalk';

import Ora from 'ora';
import Conf from 'conf';

import parseExif from '@splash-cli/parse-exif';
import showCopy from '@splash-cli/show-copy';
import isMonth from '@splash-cli/is-month';

import { errorHandler } from '../extra/utils';

const config = new Conf();
const spinner = new Ora({
  text: 'Making something awesome',
  color: 'yellow',
  spinner: isMonth('december') ? 'christmas' : 'earth',
});

const join = path.join;

// Flags, options, set as wallpaper
export default function download({
  quiet, info,
} = {}, { custom, photo, filename } = { custom: false }, setAsWallpaper = true) {
  // Increase downloads counter.
  config.set('counter', config.get('counter') + 1);

  // Check if should create username folder 'ex: @rawnly/photo-id.jpg'
  const createUsernameFolder = config.get('username-folder');

  // If no progress run the spinner
  if (!quiet) {
    spinner.start();
  }

  const defaultIMGPath = createUsernameFolder ? join(config.get('directory'), `@${photo.user.username}`) : join(config.get('directory'));


  if ( !fs.existsSync(defaultIMGPath) ) {
    mkdirp.sync(defaultIMGPath);
  }

  const size = config.get('pic-size');
  const extension = size === 'raw' ? 'tiff' : 'jpg';
  const img = filename || join(defaultIMGPath, `${photo.id}.${extension}`);
  const url = custom ? photo.urls.custom : (photo.urls[size] ? photo.urls[size] : photo.urls.full);
  const file = fs.createWriteStream(img);

  try {
    https.get(url, (response) => {
      response.pipe(file).on('finish', () => {
        if (setAsWallpaper) {
          wallpaper.set(img);
        }

        if (!quiet) {
          spinner.succeed();
        }

        // Display 'shot by ...'
        console.log();
        showCopy(photo, info);

        // Trailing space
        console.log();
      });
    });
  } catch (err) {
    errorHandler(err);
  }
}
