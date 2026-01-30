import { useState } from 'react';
import axios from '../api/axios';

function Login() {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('/account/login/', formData);
            const { access, refresh, user } = response.data;

            // 토큰 저장
            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);
            localStorage.setItem('user_info', JSON.stringify(user));

            alert(`${user.nickname}님 환영합니다!`);
            window.location.href = '/dashboard';

        } catch (error) {
            console.error('로그인 실패:', error);
            alert('이메일 또는 비밀번호를 확인해주세요.');
        }
    };

    return (
        <div className="login-container">
            <h1>로그인</h1>
            <form onSubmit={handleSubmit} className="auth-form">
                <input
                    type="email"
                    name="email"
                    placeholder="이메일"
                    value={formData.email}
                    onChange={handleChange}
                    required
                />
                <input
                    type="password"
                    name="password"
                    placeholder="비밀번호"
                    value={formData.password}
                    onChange={handleChange}
                    required
                />
                <button type="submit">로그인</button>
            </form>
            <div className="auth-link">
                <a href="/register">계정이 없으신가요? 회원가입</a>
            </div>
        </div>
    );
}

export default Login;
