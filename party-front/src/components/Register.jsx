import { useState } from 'react';
import axios from '../api/axios';

function Register() {
    const [formData, setFormData] = useState({
        email: '',
        nickname: '',
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
            await axios.post('/account/register/', formData);
            alert('회원가입 성공! 로그인해주세요.');
            window.location.href = '/login';
        } catch (error) {
            console.error('회원가입 실패:', error.response?.data);
            alert('회원가입에 실패했습니다. (이메일 중복 등 확인)');
        }
    };

    return (
        <div className="login-container">
            <h1>회원가입</h1>
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
                    type="text"
                    name="nickname"
                    placeholder="별명"
                    value={formData.nickname}
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
                <button type="submit">가입하기</button>
            </form>
            <div className="auth-link">
                <a href="/login">이미 계정이 있으신가요? 로그인</a>
            </div>
        </div>
    );
}

export default Register;
