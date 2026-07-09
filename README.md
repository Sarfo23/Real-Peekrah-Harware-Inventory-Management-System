# HIMS - Hardware Inventory Management System

A full-stack prototype for managing hardware inventory across multiple warehouses.

## Tech Stack
- **Frontend**: React (Vite), Styled-JSX
- **Backend**: Node.js, Express
- **Database**: MySQL

## Setup Instructions

### 1. Database Setup
1. Create a MySQL database named `hims_db`.
2. Run the DDL script: `db/schema.sql`.
3. (Optional) Populate with sample data: `db/seed.sql`.

### 2. Backend Setup
1. Navigate to `backend/`.
2. Create a `.env` file with the following:
   ```env
   DB_HOST=localhost
   DB_USER=your_user
   DB_PASSWORD=your_password
   DB_NAME=hims_db
   PORT=5000
   ```
3. Run `npm install`.
4. Run `npm start`.

### 3. Frontend Setup
1. Ensure your React environment is configured to proxy `/api` requests to `http://localhost:5000`.
2. The core components are located in `frontend/src/components/`.
3. The main layout is in `frontend/src/App.jsx`.

## Key Features
- **Atomic Stock Movements**: Uses DB transactions to ensure data consistency between inventory and logs.
- **Global Search**: Search products by SKU or Name with real-time stock aggregation.
- **Sales Analytics**: Monthly performance tracking for "Best Performing Product".
