import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('../backend/.env') });

const runMigration = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hims_db',
  });

  try {
    console.log('Checking database table transactions for competitor columns...');
    
    const [columns] = await connection.execute('SHOW COLUMNS FROM transactions');
    const columnNames = columns.map(c => c.Field);
    
    if (!columnNames.includes('is_competitor_sourced')) {
      console.log('Adding column: is_competitor_sourced');
      await connection.execute('ALTER TABLE transactions ADD COLUMN is_competitor_sourced TINYINT(1) NOT NULL DEFAULT 0');
    }
    
    if (!columnNames.includes('competitor_cost_price')) {
      console.log('Adding column: competitor_cost_price');
      await connection.execute('ALTER TABLE transactions ADD COLUMN competitor_cost_price DECIMAL(10,2) NULL');
    }
    
    if (!columnNames.includes('competitor_selling_price')) {
      console.log('Adding column: competitor_selling_price');
      await connection.execute('ALTER TABLE transactions ADD COLUMN competitor_selling_price DECIMAL(10,2) NULL');
    }

    console.log('Database migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
};

runMigration();
