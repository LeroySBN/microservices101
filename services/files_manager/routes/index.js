// Routes
import {Router} from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const router = Router();

router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

// Create a new user
router.post('/users', UsersController.postNew);

// Authenticate user
router.get('/connect', AuthController.getConnect);

// De-Authenticate user
router.get('/disconnect', AuthController.getDisconnect);

// Get Authenticated user
router.get('/users/me', UsersController.getMe);

// Add file or folder
router.post('/files', FilesController.postUpload);

// List files and folders
router.get('/files', FilesController.getIndex);

// File get metadata
router.get('/files/:id', FilesController.getShow);

// File publish/unpublish
router.put('/files/:id/publish', FilesController.putPublish);
router.put('/files/:id/unpublish', FilesController.putUnpublish);

// File get content
router.get('/files/:id/data', FilesController.getFile);

module.exports = router;
