import crypto from 'crypto';

/**
 * Encrypted Token Storage for User Authentication
 * In production, this should use Redis or secure database
 */

// In-memory storage for development (use Redis in production)
const tokenStore = new Map();

// Encryption configuration
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive token data
 */
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);

  let encrypted = cipher.update(JSON.stringify(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt token data
 */
function decrypt(encryptedData) {
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

/**
 * Store encrypted user token
 */
export async function storeUserToken(slackUserId, tokenData) {
  try {
    if (!tokenData) {
      // Remove token
      tokenStore.delete(slackUserId);
      return;
    }

    const encryptedData = encrypt(tokenData);
    tokenStore.set(slackUserId, {
      ...encryptedData,
      storedAt: Date.now()
    });

    console.log(`Token stored for user ${slackUserId}`);
  } catch (error) {
    console.error('Error storing token:', error);
    throw new Error('Failed to store authentication token');
  }
}

/**
 * Retrieve and decrypt user token
 */
export async function getUserToken(slackUserId) {
  try {
    const storedData = tokenStore.get(slackUserId);

    if (!storedData) {
      return null;
    }

    const tokenData = decrypt(storedData);

    // Check if token has expired
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
      // Don't automatically delete - might have refresh token
      console.log(`Token expired for user ${slackUserId}`);
    }

    return tokenData;
  } catch (error) {
    console.error('Error retrieving token:', error);
    // Remove corrupted token data
    tokenStore.delete(slackUserId);
    return null;
  }
}

/**
 * Check if user has valid authentication
 */
export async function isUserAuthenticated(slackUserId) {
  const tokenData = await getUserToken(slackUserId);

  if (!tokenData) {
    return false;
  }

  // Check if token is valid or can be refreshed
  if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
    return !!tokenData.refreshToken; // Can refresh
  }

  return true; // Token is still valid
}

/**
 * Get all authenticated users (for admin/debugging)
 */
export async function getAuthenticatedUsers() {
  const users = [];

  for (const [slackUserId, storedData] of tokenStore.entries()) {
    try {
      const tokenData = decrypt(storedData);
      users.push({
        slackUserId,
        storedAt: new Date(storedData.storedAt),
        expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt) : null,
        hasRefreshToken: !!tokenData.refreshToken,
        scope: tokenData.scope
      });
    } catch (error) {
      console.error(`Error reading token for user ${slackUserId}:`, error);
    }
  }

  return users;
}

/**
 * Clean up expired tokens (run periodically)
 */
export async function cleanupExpiredTokens() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [slackUserId, storedData] of tokenStore.entries()) {
    try {
      const tokenData = decrypt(storedData);

      // Remove tokens that are expired and have no refresh token
      if (tokenData.expiresAt && now > tokenData.expiresAt && !tokenData.refreshToken) {
        tokenStore.delete(slackUserId);
        cleanedCount++;
        console.log(`Cleaned up expired token for user ${slackUserId}`);
      }
    } catch (error) {
      // Remove corrupted data
      tokenStore.delete(slackUserId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired/corrupted tokens`);
  }

  return cleanedCount;
}

// Production Redis Implementation Example:
/*
import Redis from 'redis';

const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

export async function storeUserToken(slackUserId, tokenData) {
  const key = `partnerconnect:token:${slackUserId}`;

  if (!tokenData) {
    await redis.del(key);
    return;
  }

  const encrypted = encrypt(tokenData);
  await redis.setex(key, 86400 * 30, JSON.stringify(encrypted)); // 30 days TTL
}

export async function getUserToken(slackUserId) {
  const key = `partnerconnect:token:${slackUserId}`;
  const data = await redis.get(key);

  if (!data) return null;

  const encryptedData = JSON.parse(data);
  return decrypt(encryptedData);
}
*/