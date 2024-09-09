import {ObjectId} from 'mongodb';
import dbClient from './utils/db';
import Queue from 'bull/lib/queue';
import {writeFile as writeFileAsync} from 'fs/promises';

const imageThumbnail = require('image-thumbnail');

const THUMBNAIL_SIZE = {
  small: 100,
  medium: 250,
  large: 500,
}

const fileQueue = new Queue('thumbnail generation');

/**
 * Generates the thumbnail of an image with a given width size.
 * @param {String} filePath The location of the original file.
 * @param {number} size The width of the thumbnail.
 * @returns {Promise<void>}
 */
const generateThumbnail = async (filePath, size) => {
  console.log(`Image thumbnail generation of size ${size} started`);
  const buffer = await imageThumbnail(filePath, { width: size, height: size });
  console.log(`Generating file: ${filePath}, size: ${size}`);
  return writeFileAsync(`${filePath}_${size}`, buffer);
};

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }

  const file = await dbClient.db.collection('files').findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });

  if (!file) {
    throw new Error('File not found');
  }

  const sizes = [
      THUMBNAIL_SIZE.large,
      THUMBNAIL_SIZE.medium,
      THUMBNAIL_SIZE.small
  ];

  Promise.all(sizes.map((size) => generateThumbnail(file.localPath, size)))
    .then(() => {
      console.log('Thumbnail generation finished');
    });
});
