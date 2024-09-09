/* eslint-disable import/no-named-as-default */
/* eslint-disable no-unused-vars */

import {ObjectId} from 'mongodb';
import fs from 'fs';
import {v4} from 'uuid';
import {contentType} from 'mime-types';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import Queue from 'bull/lib/queue';

require('@dotenvx/dotenvx').config()

const ROOT_FOLDER_ID = 0;
const NULL_ID = Buffer.alloc(24, '0').toString('utf-8');
const MAX_FILES_PER_PAGE = 20;

const VALID_FILE_TYPES = {
  folder: 'folder',
  file: 'file',
  image: 'image',
};

const fileQueue = new Queue('thumbnail generation');

console.log(`Storage directory: ${process.env.FOLDER_PATH}`);
export default class FilesController {
  /**
   * Creates a new file document in the DB if the user is authenticated
   * Endpoint: POST /files
   * @static
   * @param {*} req
   * @param {*} res
   * @returns
   * @memberof FilesController
   */
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (parentId !== 0) {
      const parent = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parent) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    let localPath;
    if (type !== 'folder') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      localPath = `${folderPath}/${v4()}`;
      const bufferData = Buffer.from(data, 'base64');
      fs.writeFileSync(localPath, bufferData);
    }

    let parentIdObjectId;
    if (parentId !== 0) {
      try {
        parentIdObjectId = new ObjectId(parentId);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid parentId' });
      }

      const parentFile = await dbClient.db.collection('files').findOne({ _id: parentIdObjectId });

      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileDocument = {
      userId: new ObjectId(userId),
      name,
      type,
      parentId: parentIdObjectId || 0,
      isPublic,
      localPath: localPath || null,
    };

    const insertedFile = await dbClient.db.collection('files').insertOne(fileDocument);

    const fileId = insertedFile.insertedId.toString();

    // start thumbnail generation worker
    if (type === VALID_FILE_TYPES.image) {
      console.log('Image thumbnail generation workflow started');
      const jobName = `Image thumbnail [${userId}-${fileId}]`;
      fileQueue.add({ userId, fileId, name: jobName });
    }

    return res.status(201).json({
      id: insertedFile.insertedId,
      userId: new ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentIdObjectId || 0,
      // ...fileDocument,
    });
  }

  /**
   * Retrieve a file document based on the ID if the user is the owner of the file
   * Endpoint: GET /files/:id
   * @param {*} req
   * @param {*} res
   * @returns
   * @memberof FilesController
   */
  static async getShow(req, res) {
    // Retrieve the user based on the token
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve the file document based on the ID
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
      localPath: file.localPath,
    });
  }

  /**
   * Retrieve all users file documents for a specific parentId and with pagination
   * if the user is the owner of the file
   * Endpoint: GET /files
   * @param {*} req
   * @param {*} res
   * @returns
   * @memberof FilesController
   */
  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = /\d+/.test(req.query.page) ? parseInt(req.query.page, 10) : 0;
    const parentId = req.query.parentId || ROOT_FOLDER_ID;

    const queryFilter = parentId === ROOT_FOLDER_ID
      ? { userId: new ObjectId(userId) }
      : {
        userId: new ObjectId(userId),
        parentId: parentId === ROOT_FOLDER_ID
          ? ROOT_FOLDER_ID
          : new ObjectId(ObjectId.isValid(parentId) ? parentId : NULL_ID),
      };

    const files = await dbClient.db.collection('files')
      .aggregate([
        { $match: queryFilter },
        // { $sort: { _id: -1 } },
        { $skip: page * MAX_FILES_PER_PAGE },
        { $limit: MAX_FILES_PER_PAGE },
        {
          $project: {
            _id: 0,
            id: '$_id',
            userId: '$userId',
            name: '$name',
            type: '$type',
            isPublic: '$isPublic',
            parentId: {
              $cond: [{ $eq: ['$parentId', ROOT_FOLDER_ID] }, 0, '$parentId'],
            },
          },
        },
      ])
      .toArray();

    return res.status(200).json(files);
  }

  /**
   * Update a file document based on the ID by setting isPublic to true
   * if the user is the owner of the file
   * Endpoint: PUT /files/:id/publish
   * @param {*} req
   * @param {*} res
   * @returns
   * @memberof FilesController
   */
  static async putPublish(req, res) {
    // Retrieve the user based on the token
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve the file document based on the ID
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update the file document based on the ID
    const updatedFile = await dbClient.db.collection('files').updateOne(
      { _id: new ObjectId(fileId) },
      { $set: { isPublic: true } },
    );

    if (!updatedFile) {
      return res.status(400).json({ error: 'Not found' });
    }

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId,
    });
  }

  /**
   * Update a file document based on the ID by setting isPublic to false
   * if the user is the owner of the file
   * Endpoint: PUT /files/:id/unpublish
   * @param {*} req
   * @param {*} res
   * @returns
   * @memberof FilesController
   */
  static async putUnpublish(req, res) {
    // Retrieve the user based on the token
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve the file document based on the ID
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update the file document based on the ID
    const updatedFile = await dbClient.db.collection('files').updateOne(
      { _id: new ObjectId(fileId) },
      { $set: { isPublic: false } },
    );

    if (!updatedFile) {
      return res.status(400).json({ error: 'Not found' });
    }

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId,
    });
  }

  /**
   * Retrieve the content of a file document based on the ID
   * if the user is the owner of the file or the file is public
   * Endpoint: GET /files/:id/data
   * @param {*} req
   * @param {*} res
   * @returns
   * @memberof FilesController
   */
  static async getFile(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    const fileId = req.params.id;
    const size = req.query.size || null;

    const queryFilter = {
      _id: ObjectId.isValid(fileId) ? new ObjectId(fileId) : NULL_ID,
    };

    const file = await dbClient.db.collection('files').findOne(queryFilter);

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Check if file is public or user is the owner
    if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Check if the file is a folder
    if (file.type === VALID_FILE_TYPES.folder) {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    // Check if file is present locally
    if (!file.localPath || !fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    let filePath = file.localPath;
    
    if (size) {
      filePath = `${file.localPath}_${size}`;
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    try {
      const fileInfo = await fs.promises.stat(filePath);
      if (!fileInfo.isFile()) {
        return res.status(404).json({ error: 'Not found' });
      }
    } catch (error) {
      return res.status(404).json({ error: 'Not found'});
    }

    // commenting out next line to avoid reading the file into memory. sendfile takes charge of this
    // const fileData = fs.readFileSync(filePath);

    const absoluteFilePath = await fs.promises.realpath(filePath);

    res.setHeader('Content-Type', contentType(file.name) || 'text/plain; charset=utf-8');
    // return res.status(200).sendFile(fileData);
    return res.status(200).sendFile(absoluteFilePath, { root: '/'});
  }
}
