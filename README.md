# 🚀 Distributed Task Scheduler

A fault-tolerant, horizontally scalable, and self-healing distributed task queue built with Node.js, Redis, and PostgreSQL. Containerized entirely via Docker Compose.

This system implements a reliable **Producer-Consumer architecture** designed to asynchronously process background jobs with **zero data loss**, even in the event of hard worker node crashes.

## ✨ System Architecture & Core Features

*   **Reliable Queuing (Zero Data Loss):** Utilizes Redis `BLMOVE` to atomically transition tasks from a `main_queue` to a `processing_queue`. If a worker crashes mid-execution, the task is safely retained in memory rather than being lost.
*   **Autonomous Self-Healing:** A dedicated background `Sweeper` service continuously monitors the processing queue. It detects orphaned tasks (via stale-timeout logic) and safely re-queues them using atomic Redis Pipelines.
*   **Persistent Audit Logging:** Once a task is successfully executed, the result is permanently committed to a PostgreSQL database before the task is scrubbed from Redis, ensuring a reliable source of truth.
*   **Containerized Orchestration:** The entire ecosystem (Message Broker, Database, API, Workers, and Watchdogs) is networked and orchestrated using Docker Compose.

## 🛠️ Tech Stack

*   **Backend:** Node.js, Express.js
*   **Message Broker / Cache:** Redis (ioredis)
*   **Database:** PostgreSQL (pg)
*   **Infrastructure:** Docker, Docker Compose

---

## ⚙️ Getting Started (Local Development)

### Prerequisites
*   [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose installed on your machine.

### 1. Boot up the Infrastructure
Clone the repository and run the following command in the root directory. This will download the necessary images, build the Node.js microservices, and bind them to an isolated Docker network.

```bash
docker-compose up --build
```

### 2. Initialize the Database
*Note: You only need to do this once on the very first boot to create the database tables.*

Open a new terminal window while the containers are running and execute:
```bash
node db-setup.js
```
You should see `✅ Table "completed_tasks" created successfully!`.

---

## 📡 API Usage

### Create a Task (Producer)
Send a POST request to the Express API to enqueue a new background job.

**Endpoint:** `POST http://localhost:3000/add-task`

**Payload (JSON):**
```json
{
  "taskName": "send_welcome_email",
  "payload": {
    "userId": "123",
    "email": "user@example.com"
  }
}
```

**Watch the logs:** As soon as the request is sent, you will see the API accept it, the Worker grab it (`BLMOVE`), process it, and save the final state to PostgreSQL.

---

## 🧠 System Components

1.  **`producer.js` (The API):** A lightweight Express server. It accepts incoming web requests and pushes the payload to the Redis `main_queue` for asynchronous processing, returning a 200 OK to the client immediately.
2.  **`worker.js` (The Consumer):** A persistent Node process that blocks on the Redis queue. It executes the business logic and handles the transactional handover between Redis (volatile) and PostgreSQL (persistent).
3.  **`sweeper.js` (The Watchdog):** A background chron-process that monitors the `processing_queue` for tasks that have exceeded their maximum execution time limits (indicating a crashed worker) and rescues them.

---

## 💡 Engineering Design Decisions

*   **Why Redis over PostgreSQL for the Queue?**
    While Postgres can be used as a queue, high-frequency polling and locking create massive CPU overhead. Redis operates entirely in memory, making atomic list operations like `BLMOVE` operate in O(1) time, keeping latency incredibly low.
*   **Preventing Race Conditions during Task Rescue:**
    When the Sweeper identifies a dead task, it must remove it from the processing queue and push it to the main queue. To prevent data corruption if the Sweeper itself crashes between these two steps, both commands are executed inside a **Redis Pipeline**, guaranteeing transactional safety.