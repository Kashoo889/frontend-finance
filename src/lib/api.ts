/**
 * API utilities for backend integration
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Common fetch wrapper with auth
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
};

/**
 * Normalize MongoDB entry (convert _id to id)
 */
const normalizeEntry = (entry: any) => {
  if (!entry) return entry;
  const { _id, ...rest } = entry;
  return { id: _id?.toString() || entry.id || '', ...rest };
};

/**
 * Saudi Hisaab Kitaab API
 */
export const saudiAPI = {
  getAll: async () => {
    const data = await apiRequest('/saudi');
    const entries = data.data || [];
    return entries.map(normalizeEntry);
  },

  create: async (entry: {
    date: string;
    time: string;
    refNo: string;
    pkrAmount: number;
    riyalRate: number;
    submittedSar: number;
    reference2?: string;
  }) => {
    const data = await apiRequest('/saudi', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
    return normalizeEntry(data.data);
  },

  update: async (id: string, entry: {
    pkrAmount?: number;
    riyalRate?: number;
    submittedSar?: number;
    reference2?: string;
  }) => {
    const data = await apiRequest(`/saudi/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    });
    return normalizeEntry(data.data);
  },

  delete: async (id: string) => {
    return apiRequest(`/saudi/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Special Hisaab Kitaab API
 */
export const specialAPI = {
  getAll: async () => {
    const data = await apiRequest('/special');
    const entries = data.data || [];
    return entries.map(normalizeEntry);
  },

  create: async (entry: {
    userName: string;
    date: string;
    balanceType: 'Online' | 'Cash';
    nameRupees: number;
    submittedRupees: number;
  }) => {
    const data = await apiRequest('/special', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
    return normalizeEntry(data.data);
  },

  update: async (id: string, entry: {
    userName?: string;
    balanceType?: 'Online' | 'Cash';
    nameRupees?: number;
    submittedRupees?: number;
    referencePerson?: string;
  }) => {
    const data = await apiRequest(`/special/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    });
    return normalizeEntry(data.data);
  },

  delete: async (id: string) => {
    return apiRequest(`/special/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Traders API
 */
export const tradersAPI = {
  getAll: async () => {
    const data = await apiRequest('/traders');
    const traders = data.data || [];
    return traders.map(normalizeEntry);
  },

  getOne: async (id: string) => {
    const data = await apiRequest(`/traders/${id}`);
    const trader = normalizeEntry(data.data);
    
    // Normalize banks array if present
    if (trader.banks && Array.isArray(trader.banks)) {
      trader.banks = trader.banks.map((bank: any) => normalizeEntry(bank));
    }
    
    return trader;
  },

  create: async (trader: {
    name: string;
    shortName: string;
    color?: string;
  }) => {
    const data = await apiRequest('/traders', {
      method: 'POST',
      body: JSON.stringify(trader),
    });
    return normalizeEntry(data.data);
  },

  update: async (id: string, trader: {
    name?: string;
    shortName?: string;
    color?: string;
  }) => {
    const data = await apiRequest(`/traders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(trader),
    });
    return normalizeEntry(data.data);
  },

  delete: async (id: string) => {
    return apiRequest(`/traders/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Banks API
 */
export const banksAPI = {
  getAll: async (traderId: string) => {
    const data = await apiRequest(`/traders/${traderId}/banks`);
    const banks = data.data || [];
    return banks.map(normalizeEntry);
  },

  create: async (traderId: string, bank: {
    name: string;
    code: string;
  }) => {
    const data = await apiRequest(`/traders/${traderId}/banks`, {
      method: 'POST',
      body: JSON.stringify(bank),
    });
    return normalizeEntry(data.data);
  },

  update: async (traderId: string, bankId: string, bank: {
    name?: string;
    code?: string;
  }) => {
    const data = await apiRequest(`/traders/${traderId}/banks/${bankId}`, {
      method: 'PUT',
      body: JSON.stringify(bank),
    });
    return normalizeEntry(data.data);
  },

  delete: async (traderId: string, bankId: string) => {
    return apiRequest(`/traders/${traderId}/banks/${bankId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Bank Ledger API
 */
export const bankLedgerAPI = {
  getAll: async (traderId: string, bankId: string) => {
    const data = await apiRequest(`/traders/${traderId}/banks/${bankId}/ledger`);
    const entries = data.data || [];
    return {
      entries: entries.map(normalizeEntry),
      totalBalance: data.totalBalance || 0,
    };
  },

  create: async (
    traderId: string,
    bankId: string,
    entry: {
      date: string;
      referenceType: 'Online' | 'Cash';
      amountAdded?: number;
      amountWithdrawn?: number;
    }
  ) => {
    const data = await apiRequest(`/traders/${traderId}/banks/${bankId}/ledger`, {
      method: 'POST',
      body: JSON.stringify(entry),
    });
    return normalizeEntry(data.data);
  },

  update: async (
    traderId: string,
    bankId: string,
    entryId: string,
    entry: {
      date?: string;
      referenceType?: 'Online' | 'Cash';
      amountAdded?: number;
      amountWithdrawn?: number;
    }
  ) => {
    const data = await apiRequest(`/traders/${traderId}/banks/${bankId}/ledger/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    });
    return normalizeEntry(data.data);
  },

  delete: async (traderId: string, bankId: string, entryId: string) => {
    return apiRequest(`/traders/${traderId}/banks/${bankId}/ledger/${entryId}`, {
      method: 'DELETE',
    });
  },
};

