import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});
api.interceptors.request.use((config) => {
    const userId = localStorage.getItem('current_user_id');
    if (userId) {
        config.headers['x-user-id'] = userId;
    }
    return config;
});
export default api;
