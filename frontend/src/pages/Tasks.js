import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/tasks');
      setTasks(data.tasks || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load tasks');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    try {
      await api.post('/tasks', { title });
      setTitle('');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create task');
    }
  }

  async function setStatus(task, status) {
    try {
      await api.patch(`/tasks/${task.id}`, { status });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update task');
    }
  }

  return (
    <div className="page">
      <h1>Staff tasks</h1>
      <p>Authenticated follow-ups stored against your own account.</p>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={create}>
        <label>
          New task
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </label>
        <button type="submit">Add task</button>
      </form>
      <section aria-label="Task list">
        <h2>Your tasks</h2>
        {tasks.length === 0 ? (
          <p>No tasks yet.</p>
        ) : (
          <ul>
            {tasks.map((task) => (
              <li key={task.id}>
                <strong>{task.title}</strong> — {task.status} · Priority: {task.priority}
                {task.dueAt ? ` · Due: ${String(task.dueAt).slice(0, 10)}` : ''}
                {task.status !== 'DONE' && (
                  <button type="button" onClick={() => setStatus(task, 'DONE')}>Mark done</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
