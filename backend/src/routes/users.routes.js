import { Router } from 'express';
import { createUser, deleteUser, listUsers, updateUser } from '../controllers/users.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { roleMiddleware } from '../middlewares/role.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

router.use(authMiddleware, roleMiddleware(['ADMIN']));

router.get('/', asyncHandler(listUsers));
router.post('/', asyncHandler(createUser));
router.patch('/:id', asyncHandler(updateUser));
router.delete('/:id', asyncHandler(deleteUser));

export default router;
