import axios from 'axios';

const instance = axios.create({
    baseURL: 'http://localhost:8000/api', // Django API Base URL
    timeout: 5000,
});

// 요청 인터셉터: 토큰 자동 포함
instance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default instance;
