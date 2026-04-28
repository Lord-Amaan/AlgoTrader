import axios from 'axios';

const getBaseURL = () => {
  // Use environment variable if set (production)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Default to relative path (development)
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

export function setupAxiosInterceptor(getToken) {
  const interceptorId = api.interceptors.request.use(async (config) => {
    // Attach Clerk token on every request so backend can identify the logged-in user.
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return () => {
    api.interceptors.request.eject(interceptorId);
  };
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If session is invalid/expired, push user back to sign-in.
    if (error.response?.status === 401) {
      window.location.href = '/sign-in';
    }
    return Promise.reject(error);
  }
);

export default api;
