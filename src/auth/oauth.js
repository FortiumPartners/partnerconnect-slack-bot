import crypto from 'crypto';
import axios from 'axios';
import { storeUserToken, getUserToken } from './tokens.js';

/**
 * PartnerConnect OAuth2 Authentication Handler
 * Handles the OAuth flow for individual Slack users
 */
export class PartnerConnectOAuth {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tokenEndpoint = config.tokenEndpoint;
    this.audience = config.audience;
    this.redirectUri = config.redirectUri;
    this.stateStore = new Map(); // In production, use Redis
  }

  /**
   * Generate secure state parameter for OAuth flow
   */
  generateState(slackUserId) {
    const state = crypto.randomBytes(32).toString('hex');
    this.stateStore.set(state, {
      slackUserId,
      timestamp: Date.now(),
      expires: Date.now() + (10 * 60 * 1000) // 10 minutes
    });
    return state;
  }

  /**
   * Validate and retrieve state information
   */
  validateState(state) {
    const stateData = this.stateStore.get(state);
    if (!stateData || Date.now() > stateData.expires) {
      this.stateStore.delete(state);
      throw new Error('Invalid or expired state parameter');
    }

    this.stateStore.delete(state);
    return stateData.slackUserId;
  }

  /**
   * Get authorization URL for user to complete OAuth
   */
  getAuthorizationUrl(slackUserId) {
    const state = this.generateState(slackUserId);

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'read:clients read:invoices read:bills read:engagements read:users',
      redirect_uri: this.redirectUri,
      state: state,
      audience: this.audience
    });

    return `${this.tokenEndpoint.replace('/oauth/token', '/authorize')}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, state) {
    try {
      // Validate state and get Slack user ID
      const slackUserId = this.validateState(state);

      // Exchange code for token
      const response = await axios.post(this.tokenEndpoint, {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri,
        audience: this.audience
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const { access_token, refresh_token, expires_in } = response.data;

      // Store encrypted token for user
      await storeUserToken(slackUserId, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + (expires_in * 1000),
        scope: 'read:clients read:invoices read:bills read:engagements read:users'
      });

      return { success: true, slackUserId };

    } catch (error) {
      console.error('OAuth token exchange failed:', error.response?.data || error.message);
      throw new Error(`Authentication failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Get valid access token for user (with refresh if needed)
   */
  async getValidToken(slackUserId) {
    try {
      const tokenData = await getUserToken(slackUserId);

      if (!tokenData) {
        throw new Error('USER_NOT_AUTHENTICATED');
      }

      // Check if token is still valid (with 5 minute buffer)
      const now = Date.now();
      const expiryBuffer = 5 * 60 * 1000; // 5 minutes

      if (tokenData.expiresAt && (now + expiryBuffer) < tokenData.expiresAt) {
        return tokenData.accessToken;
      }

      // Token expired or about to expire, refresh it
      if (tokenData.refreshToken) {
        return await this.refreshToken(slackUserId, tokenData.refreshToken);
      }

      throw new Error('TOKEN_EXPIRED');

    } catch (error) {
      if (error.message === 'USER_NOT_AUTHENTICATED' || error.message === 'TOKEN_EXPIRED') {
        throw error;
      }
      console.error('Error getting valid token:', error);
      throw new Error('AUTHENTICATION_ERROR');
    }
  }

  /**
   * Refresh expired access token
   */
  async refreshToken(slackUserId, refreshToken) {
    try {
      const response = await axios.post(this.tokenEndpoint, {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        audience: this.audience
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const { access_token, refresh_token, expires_in } = response.data;

      // Update stored token
      await storeUserToken(slackUserId, {
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken, // Keep old refresh token if new one not provided
        expiresAt: Date.now() + (expires_in * 1000),
        scope: 'read:clients read:invoices read:bills read:engagements read:users'
      });

      return access_token;

    } catch (error) {
      console.error('Token refresh failed:', error.response?.data || error.message);
      // If refresh fails, user needs to re-authenticate
      throw new Error('TOKEN_EXPIRED');
    }
  }

  /**
   * Revoke user's stored tokens (logout)
   */
  async revokeToken(slackUserId) {
    try {
      const tokenData = await getUserToken(slackUserId);
      if (tokenData) {
        // Optionally call PartnerConnect revoke endpoint
        // await axios.post(revokeEndpoint, { token: tokenData.accessToken });

        // Remove from storage
        await storeUserToken(slackUserId, null);
      }
    } catch (error) {
      console.error('Error revoking token:', error);
    }
  }
}

/**
 * Create OAuth handler with environment configuration
 */
export function createOAuthHandler() {
  return new PartnerConnectOAuth({
    clientId: process.env.PARTNERCONNECT_CLIENT_ID,
    clientSecret: process.env.PARTNERCONNECT_CLIENT_SECRET,
    tokenEndpoint: process.env.PARTNERCONNECT_TOKEN_ENDPOINT,
    audience: process.env.PARTNERCONNECT_AUDIENCE,
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'https://yourbot.com/auth/callback'
  });
}