const express = require('express');
const Redis = require('ioredis');

const app = express();
app.use(express.json());

// Connect to our local Docker Redis instance
const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1', // This is the crucial change!
    port: 6379,
});

// This is our Producer Endpoint
app.post('/add-task', async (req, res) => {
    const { taskName, payload } = req.body;

    if (!taskName) {
        return res.status(400).json({ error: 'Task name is required' });
    }

    // 1. Create a unique ID for the task (helps with tracking later)
    const taskId = `task_${Date.now()}`;
    
    // 2. Package the task data
    const taskData = {
        id: taskId,
        name: taskName,
        payload: payload,
        status: 'pending',
        timestamp: Date.now()
    };

    try {
        // 3. Push the task to a Redis List named 'main_queue'
        // LPUSH adds the item to the left (head) of the list
        await redis.lpush('main_queue', JSON.stringify(taskData));
        
        console.log(`[Producer] Added task: ${taskId} to main_queue`);
        res.status(200).json({ message: 'Task added to queue successfully', taskId });
    } catch (error) {
        console.error('Redis error:', error);
        res.status(500).json({ error: 'Failed to add task to queue' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Producer API running on http://localhost:${PORT}`);
});