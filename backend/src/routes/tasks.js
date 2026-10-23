'use strict';
// Authenticated staff tasks over the caller's own records (Prisma StaffTask).
const express = require('express');
const { authenticateToken } = require('../middleware/auth');

function parseTaskPriority(value) {
  return value === 'LOW' || value === 'HIGH' ? value : 'NORMAL';
}
function parseTaskStatus(value) {
  return value === 'OPEN' || value === 'DONE' || value === 'CANCELLED' ? value : null;
}

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const status = parseTaskStatus(String(req.query.status || ''));
    const tasks = await prisma.staffTask.findMany({
      where: { userId: req.user.id, ...(status ? { status } : {}) },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    res.json({ tasks });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch tasks' }); }
});

router.post('/', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(422).json({ error: 'title is required' });
  try {
    const prisma = req.app.get('prisma');
    const dueAt = typeof req.body?.dueAt === 'string' && !Number.isNaN(Date.parse(req.body.dueAt)) ? new Date(req.body.dueAt) : null;
    const task = await prisma.staffTask.create({
      data: { title: title.slice(0, 200), description: typeof req.body?.description === 'string' ? req.body.description.slice(0, 2000) : null, priority: parseTaskPriority(req.body?.priority), dueAt, userId: req.user.id },
    });
    res.status(201).json({ task });
  } catch (error) { res.status(500).json({ error: 'Failed to create task' }); }
});

router.patch('/:id', async (req, res) => {
  const status = req.body?.status === undefined ? undefined : parseTaskStatus(String(req.body.status));
  if (req.body?.status !== undefined && !status) return res.status(422).json({ error: 'status must be OPEN, DONE, or CANCELLED' });
  try {
    const prisma = req.app.get('prisma');
    const existing = await prisma.staffTask.findFirst({ where: { id: String(req.params.id), userId: req.user.id } });
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    const task = await prisma.staffTask.update({
      where: { id: existing.id },
      data: {
        ...(status !== undefined ? { status, completedAt: status === 'DONE' ? new Date() : null } : {}),
        ...(typeof req.body?.title === 'string' && req.body.title.trim() ? { title: req.body.title.trim().slice(0, 200) } : {}),
        ...(req.body?.priority !== undefined ? { priority: parseTaskPriority(req.body.priority) } : {}),
      },
    });
    res.json({ task });
  } catch (error) { res.status(500).json({ error: 'Failed to update task' }); }
});

module.exports = router;
module.exports.parseTaskPriority = parseTaskPriority;
module.exports.parseTaskStatus = parseTaskStatus;
