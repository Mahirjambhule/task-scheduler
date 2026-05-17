const Redis = require('ioredis');
const { Client } = require('pg');

const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1', // This is the crucial change!
    port: 6379,
});
// Set up PostgreSQL connection
const pgClient = new Client({
    user: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    database: 'postgres',
    password: 'supersecret',
    port: 5432,
});

console.log('👷 FAANG Worker node started. Waiting for tasks...');

async function startWorker() {
    // Connect to the database once when the worker starts
    await pgClient.connect();
    console.log('🔌 Worker connected to PostgreSQL');

    while (true) {
        try {
            // 1. Grab task securely
            const taskJson = await redis.blmove(
                'main_queue', 
                'processing_queue', 
                'RIGHT', 
                'LEFT', 
                0
            );
            
            const task = JSON.parse(taskJson);
            console.log(`\n[Worker] 📥 Grabbed task: ${task.id}`);

            // 2. SIMULATE WORK (2 seconds)
            console.log(`[Worker] ⚙️ Processing...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // 3. Save to Permanent Storage (PostgreSQL)
            const insertQuery = `
                INSERT INTO completed_tasks (id, task_name, payload, status)
                VALUES ($1, $2, $3, $4)
            `;
            const values = [task.id, task.name, task.payload, 'completed'];
            
            await pgClient.query(insertQuery, values);
            console.log(`[Worker] 💾 Saved task ${task.id} to PostgreSQL`);

            // 4. ON SUCCESS: Remove from Redis processing_queue
            await redis.lrem('processing_queue', 1, taskJson);
            console.log(`[Worker] ✅ Task fully complete and cleaned from Redis.`);

        } catch (error) {
            console.error('[Worker] Fatal error:', error);
            // If the Postgres INSERT fails, we jump to this catch block.
            // The task is NEVER removed from Redis, meaning it's safe!
        }
    }
}

startWorker();