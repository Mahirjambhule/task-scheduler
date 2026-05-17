# Use a lightweight version of Node.js
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and install dependencies first (for caching)
COPY package.json ./
RUN npm install

# Copy all your JavaScript files into the container
COPY . .

# We don't set a default CMD here because we will use this same image 
# to run the producer, worker, and sweeper separately!