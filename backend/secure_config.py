import os
import json
import tempfile
from pathlib import Path
from typing import Optional, Dict
from cryptography.fernet import Fernet
import logging

logger = logging.getLogger(__name__)

try:
    import fcntl
    _HAS_FCNTL = True
except ImportError:
    _HAS_FCNTL = False  # Windows


class SecureConfigManager:
    """Manages encrypted storage of sensitive configuration."""
    
    def __init__(self, config_dir: str = "./config"):
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(exist_ok=True)
        self.config_file = self.config_dir / "credentials.enc"
        self.key_file = self.config_dir / ".key"
        self._ensure_key()
    
    def _ensure_key(self):
        """Ensure encryption key exists, with file locking to prevent race conditions."""
        if self.key_file.exists():
            return
        
        if _HAS_FCNTL:
            # Use file locking on Linux to prevent multiple workers from
            # generating different keys simultaneously
            lock_file = self.config_dir / ".key.lock"
            lock_fd = None
            try:
                lock_fd = open(lock_file, 'w')
                fcntl.flock(lock_fd, fcntl.LOCK_EX)
                # Re-check after acquiring lock (another process may have created it)
                if not self.key_file.exists():
                    key = Fernet.generate_key()
                    # Atomic write: write to temp file then rename
                    fd, tmp_path = tempfile.mkstemp(dir=str(self.config_dir))
                    try:
                        os.write(fd, key)
                        os.close(fd)
                        os.rename(tmp_path, str(self.key_file))
                    except Exception:
                        os.close(fd) if not os.get_inheritable(fd) else None
                        if os.path.exists(tmp_path):
                            os.unlink(tmp_path)
                        raise
                    try:
                        os.chmod(self.key_file, 0o600)
                    except Exception as e:
                        logger.warning(f"Could not set file permissions: {e}")
                    logger.info("Generated new encryption key (locked)")
            finally:
                if lock_fd:
                    lock_fd.close()
        else:
            # Windows fallback — no file locking needed (single process dev)
            if not self.key_file.exists():
                key = Fernet.generate_key()
                self.key_file.write_bytes(key)
                try:
                    os.chmod(self.key_file, 0o600)
                except Exception as e:
                    logger.warning(f"Could not set file permissions: {e}")
                logger.info("Generated new encryption key")
    
    def _get_cipher(self) -> Fernet:
        """Get the cipher instance."""
        key = self.key_file.read_bytes()
        return Fernet(key)
    
    def save_credentials(self, notion_api_key: str, notion_database_id: str, jwt_secret_key: Optional[str] = None):
        """Encrypt and save credentials."""
        # Load existing credentials to preserve jwt_secret_key if not provided
        existing = self.load_credentials()
        
        data = {
            "notion_api_key": notion_api_key,
            "notion_database_id": notion_database_id,
            "jwt_secret_key": jwt_secret_key or existing.get("jwt_secret_key")
        }
        
        try:
            cipher = self._get_cipher()
            encrypted_data = cipher.encrypt(json.dumps(data).encode())
            self.config_file.write_bytes(encrypted_data)
            
            # Secure file permissions
            try:
                os.chmod(self.config_file, 0o600)
            except Exception as e:
                logger.warning(f"Could not set file permissions: {e}")
            
            logger.info("Credentials saved successfully")
        except Exception as e:
            logger.error(f"Error saving credentials: {e}")
            raise
    
    def load_credentials(self) -> Dict[str, Optional[str]]:
        """Decrypt and load credentials."""
        if not self.config_file.exists():
            return {"notion_api_key": None, "notion_database_id": None, "jwt_secret_key": None}
        
        try:
            cipher = self._get_cipher()
            encrypted_data = self.config_file.read_bytes()
            decrypted_data = cipher.decrypt(encrypted_data)
            credentials = json.loads(decrypted_data.decode())
            logger.info("Credentials loaded successfully")
            return credentials
        except Exception as e:
            logger.error(
                f"CRITICAL: Cannot decrypt credentials — encryption key may have changed. "
                f"All existing JWT tokens will be invalidated. "
                f"If this persists, delete {self.config_file} and {self.key_file} to reset. "
                f"Error: {e}"
            )
            # If decryption fails, return empty credentials
            return {"notion_api_key": None, "notion_database_id": None, "jwt_secret_key": None}
    
    def clear_credentials(self):
        """Delete stored credentials."""
        try:
            if self.config_file.exists():
                self.config_file.unlink()
                logger.info("Credentials cleared")
        except Exception as e:
            logger.error(f"Error clearing credentials: {e}")


# Global instance
secure_config = SecureConfigManager()
