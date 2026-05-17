const Redis = require('ioredis');

const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1', // This is the crucial change!
    port: 6379,
});

// We define how long a task is allowed to process before we consider it "dead"
// Our task takes 2 seconds, so if it's been processing for 10 seconds, something is wrong.
const STALE_TIMEOUT_MS = 10000; 

console.log('🧹 Sweeper service started. Monitoring for stuck tasks...');

async function sweep() {
    try {
        // 1. Look at EVERY task currently in the processing_queue
        // LRANGE gets items from a list. 0 to -1 means "get everything from start to end"
        const processingTasks = await redis.lrange('processing_queue', 0, -1);

        if (processingTasks.length === 0) return; // Nothing to check

        for (const taskJson of processingTasks) {
            const task = JSON.parse(taskJson);
            const timeSinceCreated = Date.now() - task.timestamp;

            // 2. Check if the task is older than our timeout limit
            if (timeSinceCreated > STALE_TIMEOUT_MS) {
                console.log(`\n[Sweeper] 🚨 Found stuck task: ${task.id}. It has been stuck for ${timeSinceCreated}ms.`);
                
                // Give the task a fresh timestamp so the sweeper doesn't instantly grab it again
                task.timestamp = Date.now();
                const updatedTaskJson = JSON.stringify(task);

                // 3. Rescue the task! 
                // We use a Redis "Pipeline" to execute these two commands atomically (all at once)
                const pipeline = redis.pipeline();
                pipeline.lrem('processing_queue', 1, taskJson); // Remove the old stuck task
                pipeline.lpush('main_queue', updatedTaskJson);  // Push the fresh task back to the main queue
                await pipeline.exec();

                console.log(`[Sweeper] ♻️ Rescued task ${task.id} and moved it back to main_queue.`);
            }
        }
    } catch (error) {
        console.error('[Sweeper] Error during sweep:', error);
    }
}

// Run the sweep function every 5 seconds
setInterval(sweep, 5000);