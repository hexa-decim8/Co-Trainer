"""
Migration script to add refresh_token column to users table.
Run this script once to update the database schema.

Usage:
    python migrate_add_refresh_token.py
"""

import sqlite3
from pathlib import Path

# Path to the database
DB_PATH = Path(__file__).parent / "co_trainer.db"

def migrate():
    """Add refresh_token column to users table if it doesn't exist."""
    
    if not DB_PATH.exists():
        print(f"Error: Database not found at {DB_PATH}")
        return False
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'refresh_token' in columns:
            print("✓ refresh_token column already exists. No migration needed.")
            return True
        
        # Add the column
        print("Adding refresh_token column to users table...")
        cursor.execute("ALTER TABLE users ADD COLUMN refresh_token VARCHAR")
        conn.commit()
        
        print("✓ Successfully added refresh_token column.")
        
        # Verify the column was added
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'refresh_token' in columns:
            print("✓ Migration verified successfully.")
            return True
        else:
            print("✗ Migration verification failed.")
            return False
            
    except sqlite3.Error as e:
        print(f"✗ Database error: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Co-Trainer Database Migration: Add refresh_token")
    print("=" * 60)
    print()
    
    success = migrate()
    
    print()
    if success:
        print("✓ Migration completed successfully!")
        print("You can now restart the server.")
    else:
        print("✗ Migration failed. Please check the errors above.")
        exit(1)
