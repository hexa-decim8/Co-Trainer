import os
import json
from pathlib import Path
from typing import Optional, Dict
from cryptography.fernet import Fernet
import logging

logger = logging.getLogger(__name__)


class SecureConfigManager:
    """Manages encrypted storage of sensitive configuration."""
    
    def __init__(self, config_dir: str = "./config"):
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(exist_ok=True)
        self.config_file = self.config_dir / "credentials.enc"
        self.key_file = self.config_dir / ".key"
        self._ensure_key()
    
    def _ensure_key(self):
        """Ensure encryption key exists."""
        if not self.key_file.exists():
            # Generate a key based on machine-specific data
            key = Fernet.generate_key()
            self.key_file.write_bytes(key)
            # Secure the key file permissions (Unix-like systems)
            try:
                os.chmod(self.key_file, 0o600)
            except Exception as e:
                logger.warning(f"Could not set file permissions: {e}")
    
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
            logger.error(f"Error loading credentials: {e}")
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
