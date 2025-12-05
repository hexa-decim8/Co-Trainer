"""
Database migration script to add role column to users table.
Run this once to upgrade existing database.
"""
import sqlite3
import os
from datetime import datetime

def migrate():
    # Determine database path
    db_path = os.getenv('DATABASE_URL', 'sqlite:///./co_trainer.db').replace('sqlite:///', '')
    
    print(f"Database path: {db_path}")
    
    # Check if database exists
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        print("Please initialize the database first by starting the backend server.")
        return
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if users table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if not cursor.fetchone():
            print("❌ Users table not found. Please initialize the database first.")
            return
        
        # Check if role column already exists
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'role' in columns:
            print("✓ Role column already exists")
        else:
            # Add role column with default value 'user'
            print("Adding role column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
            print("✓ Role column added")
        
        # Check if there are any users
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        if user_count > 0:
            # Get the first user (oldest by created_at)
            cursor.execute("SELECT id, email FROM users ORDER BY created_at ASC LIMIT 1")
            first_user = cursor.fetchone()
            
            if first_user:
                user_id, email = first_user
                
                # Check if first user is already admin
                cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
                current_role = cursor.fetchone()[0]
                
                if current_role != 'admin':
                    # Set first user as admin
                    print(f"Setting first user ({email}) as admin...")
                    cursor.execute("UPDATE users SET role = 'admin' WHERE id = ?", (user_id,))
                    print(f"✓ User {email} is now admin")
                else:
                    print(f"✓ User {email} is already admin")
        else:
            print("No users in database yet. First registered user will become admin.")
        
        # Create index on role column for faster queries
        print("Creating index on role column...")
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)")
            print("✓ Index created")
        except sqlite3.OperationalError:
            print("✓ Index already exists")
        
        # Commit changes
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("RBAC Migration Script")
    print("=" * 60)
    migrate()
