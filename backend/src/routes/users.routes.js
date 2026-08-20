import { Router } from 'express';
import { createUser, deleteUser, listUsers, updateUser } from '../controllers/users.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { roleMiddleware } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authMiddleware, roleMiddleware(['ADMIN']));

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
