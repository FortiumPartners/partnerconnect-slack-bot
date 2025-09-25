import axios from 'axios';

/**
 * PartnerConnect API Client for Direct API Calls
 * Used by fast commands for immediate responses
 */
export class PartnerConnectAPI {
  constructor(config) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 30000;
  }

  /**
   * Make authenticated API call
   */
  async request(method, endpoint, userToken, data = null, params = {}) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      };

      if (data) {
        config.data = data;
      }

      if (Object.keys(params).length > 0) {
        config.params = params;
      }

      const response = await axios(config);
      return response.data;

    } catch (error) {
      if (error.response) {
        // API returned error response
        const status = error.response.status;
        const message = error.response.data?.message || error.response.statusText;

        if (status === 401) {
          throw new Error('AUTHENTICATION_REQUIRED');
        } else if (status === 403) {
          throw new Error('INSUFFICIENT_PERMISSIONS');
        } else if (status === 404) {
          throw new Error('RESOURCE_NOT_FOUND');
        } else if (status >= 500) {
          throw new Error('API_SERVER_ERROR');
        } else {
          throw new Error(`API_ERROR: ${message}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('REQUEST_TIMEOUT');
      } else {
        throw new Error(`NETWORK_ERROR: ${error.message}`);
      }
    }
  }

  /**
   * GET request
   */
  async get(endpoint, userToken, params = {}) {
    return this.request('GET', endpoint, userToken, null, params);
  }

  /**
   * POST request
   */
  async post(endpoint, userToken, data) {
    return this.request('POST', endpoint, userToken, data);
  }

  /**
   * PUT request
   */
  async put(endpoint, userToken, data) {
    return this.request('PUT', endpoint, userToken, data);
  }

  /**
   * DELETE request
   */
  async delete(endpoint, userToken) {
    return this.request('DELETE', endpoint, userToken);
  }

  // Specific endpoint methods for common operations

  /**
   * Get invoices with filters
   */
  async getInvoices(userToken, filters = {}) {
    const params = new URLSearchParams();

    if (filters.paid !== undefined) {
      params.append('Paid', filters.paid.toString());
    }
    if (filters.clientName) {
      params.append('ClientName', filters.clientName);
    }
    if (filters.delivererName) {
      params.append('DelivererName', filters.delivererName);
    }
    if (filters.dateFrom) {
      params.append('InvoiceDate', `>=${filters.dateFrom}`);
    }
    if (filters.dateTo) {
      params.append('InvoiceDate', `<=${filters.dateTo}`);
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }

    return this.get(`/invoices?${params.toString()}`, userToken);
  }

  /**
   * Get specific invoice by ID
   */
  async getInvoice(userToken, invoiceId) {
    return this.get(`/invoices/${invoiceId}`, userToken);
  }

  /**
   * Get bills with filters
   */
  async getBills(userToken, filters = {}) {
    const params = new URLSearchParams();

    if (filters.paid !== undefined) {
      params.append('Paid', filters.paid.toString());
    }
    if (filters.overdue !== undefined) {
      params.append('Overdue', filters.overdue.toString());
    }
    if (filters.clientName) {
      params.append('ClientName', filters.clientName);
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }

    return this.get(`/bills?${params.toString()}`, userToken);
  }

  /**
   * Get clients with search
   */
  async getClients(userToken, filters = {}) {
    const params = new URLSearchParams();

    if (filters.name) {
      params.append('Name', filters.name);
    }
    if (filters.active !== undefined) {
      params.append('Active', filters.active.toString());
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }

    return this.get(`/clients?${params.toString()}`, userToken);
  }

  /**
   * Get specific client by ID
   */
  async getClient(userToken, clientId) {
    return this.get(`/clients/${clientId}`, userToken);
  }

  /**
   * Get engagements with filters
   */
  async getEngagements(userToken, filters = {}) {
    const params = new URLSearchParams();

    if (filters.active !== undefined) {
      params.append('Active', filters.active.toString());
    }
    if (filters.clientUid) {
      params.append('ClientUid', filters.clientUid);
    }
    if (filters.clientName) {
      params.append('ClientName', filters.clientName);
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }

    return this.get(`/engagements?${params.toString()}`, userToken);
  }

  /**
   * Get users with search
   */
  async getUsers(userToken, filters = {}) {
    const params = new URLSearchParams();

    if (filters.email) {
      params.append('Email', filters.email);
    }
    if (filters.name) {
      params.append('Name', filters.name);
    }
    if (filters.active !== undefined) {
      params.append('Active', filters.active.toString());
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }

    return this.get(`/users?${params.toString()}`, userToken);
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      // Use a simple endpoint that doesn't require auth
      await axios.get(`${this.baseURL}/health`, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Create API client with environment configuration
 */
export function createPartnerConnectAPI() {
  return new PartnerConnectAPI({
    baseURL: process.env.PARTNERCONNECT_API_URL + '/api',
    timeout: parseInt(process.env.API_TIMEOUT) || 30000
  });
}