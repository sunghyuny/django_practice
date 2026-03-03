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

// 응답 인터셉터: 401 처리 (토큰 만료 시 자동 로그아웃)
instance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // 토큰 만료 등 인증 에러 시 로컬 스토리지 삭제 및 로그인 페이지로 이동
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user_info');
            // 로그인 페이지가 아닌 경우에만 리다이렉트
            if (window.location.pathname !== '/login' && window.location.pathname !== '/' && window.location.pathname !== '/register') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default instance;
