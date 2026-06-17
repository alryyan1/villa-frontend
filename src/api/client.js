import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost/villa/backend/public/api/v1',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('villa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('villa_token');
      localStorage.removeItem('villa_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
