"""Database migration script to add user authentication tables."""
import sys
from sqlalchemy import create_engine, inspect, text
from database import Base, UserDB, UserNotionConfig, PracticePlanDB
from auth import get_password_hash
from config import settings

def migrate():
    """Run database migration."""
    engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
    inspector = inspect(engine)
    
    print("Starting database migration...")
    
    # Check if users table already exists
    if 'users' in inspector.get_table_names():
        print("✓ Users table already exists")
    else:
        print("Creating users table...")
        UserDB.__table__.create(engine)
        print("✓ Users table created")
    
    # Check if user_notion_configs table exists
    if 'user_notion_configs' in inspector.get_table_names():
        print("✓ User notion configs table already exists")
    else:
        print("Creating user_notion_configs table...")
        UserNotionConfig.__table__.create(engine)
        print("✓ User notion configs table created")
    
    # Check if practice_plans table needs user_id column
    if 'practice_plans' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('practice_plans')]
        if 'user_id' not in columns:
            print("Adding user_id column to practice_plans table...")
            with engine.connect() as conn:
                # Add user_id column (nullable initially)
                conn.execute(text("ALTER TABLE practice_plans ADD COLUMN user_id INTEGER"))
                conn.commit()
            print("✓ user_id column added to practice_plans")
        else:
            print("✓ practice_plans table already has user_id column")
    
    # Create default admin user if no users exist
    from sqlalchemy.orm import sessionmaker
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        user_count = db.query(UserDB).count()
        if user_count == 0:
            print("Creating default admin user...")
            admin = UserDB(
                email="admin@cotrainer.local",
                hashed_password=get_password_hash("changeMe123!"),
                username="Admin",
                derby_name="The Admin"
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print(f"✓ Default admin user created")
            print(f"  Email: admin@cotrainer.local")
            print(f"  Password: changeMe123!")
            print(f"  ⚠️  Please change this password after first login!")
            
            # Update any orphaned practice plans to belong to admin
            orphaned_count = db.execute(
                text("UPDATE practice_plans SET user_id = :user_id WHERE user_id IS NULL"),
                {"user_id": admin.id}
            )
            db.commit()
            if orphaned_count.rowcount > 0:
                print(f"✓ Assigned {orphaned_count.rowcount} existing plans to admin user")
        else:
            print(f"✓ {user_count} user(s) already exist")
    finally:
        db.close()
    
    print("\n✅ Migration completed successfully!")
    print("\nNext steps:")
    print("1. Start the backend server: uvicorn main:app --reload")
    print("2. Login with admin@cotrainer.local / changeMe123!")
    print("3. Change the admin password in settings")
    print("4. Create your user accounts")

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)
