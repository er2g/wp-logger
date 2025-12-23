import { pool } from '../../../config/database';
import { User, WebAuthnCredential } from '../../../types/database.types';
import logger from '../../../utils/logger';

export class UserRepository {
  async create(username: string): Promise<User> {
    try {
      const result = await pool.query<User>(
        'INSERT INTO users (username) VALUES ($1) RETURNING *',
        [username]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const result = await pool.query<User>(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find user by id:', error);
      throw error;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const result = await pool.query<User>(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find user by username:', error);
      throw error;
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [id]
      );
    } catch (error) {
      logger.error('Failed to update last login:', error);
      throw error;
    }
  }

  async findCredentialsByUserId(userId: string): Promise<WebAuthnCredential[]> {
    try {
      const result = await pool.query<WebAuthnCredential>(
        'SELECT * FROM webauthn_credentials WHERE user_id = $1',
        [userId]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to find credentials:', error);
      throw error;
    }
  }

  async findCredentialByCredentialId(credentialId: string): Promise<WebAuthnCredential | null> {
    try {
      const result = await pool.query<WebAuthnCredential>(
        'SELECT * FROM webauthn_credentials WHERE credential_id = $1',
        [credentialId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find credential by credential_id:', error);
      throw error;
    }
  }

  async saveCredential(
    userId: string,
    credentialId: string,
    publicKey: string,
    counter: number,
    transports: string[] | null
  ): Promise<WebAuthnCredential> {
    try {
      const result = await pool.query<WebAuthnCredential>(
        `INSERT INTO webauthn_credentials
         (user_id, credential_id, public_key, counter, transports)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, credentialId, publicKey, counter, transports]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to save credential:', error);
      throw error;
    }
  }

  async updateCredentialCounter(credentialId: string, counter: number): Promise<void> {
    try {
      await pool.query(
        'UPDATE webauthn_credentials SET counter = $1, last_used = NOW() WHERE credential_id = $2',
        [counter, credentialId]
      );
    } catch (error) {
      logger.error('Failed to update credential counter:', error);
      throw error;
    }
  }
}

export default new UserRepository();
