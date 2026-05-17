const { Client } = require('pg');

// Connect to our local Docker Postgres instance
const client = new Client({
    user: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    database: 'postgres',
    password: 'supersecret',
    port: 5432,
});

async function createTable() {
    try {
        await client.connect();
        console.log('🔌 Connected to PostgreSQL');

        // We use JSONB for the payload so we can easily search inside the JSON later if needed!
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS completed_tasks (
                id VARCHAR(255) PRIMARY KEY,
                task_name VARCHAR(255) NOT NULL,
                payload JSONB,
                status VARCHAR(50),
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await client.query(createTableQuery);
        console.log('✅ Table "completed_tasks" created successfully!');

    } catch (error) {
        console.error('❌ Database error:', error);
    } finally {
        await client.end();
    }
}

createTable();