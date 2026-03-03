import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

function Navbar() {
    const location = useLocation();
    const [visible, setVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    // 스크롤 시 네비바 숨기기/보이기
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            setVisible(currentScrollY < lastScrollY || currentScrollY < 50);
            setLastScrollY(currentScrollY);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    // 로그인/회원가입 페이지에서는 숨기기
    const hiddenPaths = ['/', '/login', '/register'];
    if (hiddenPaths.includes(location.pathname)) return null;

    return (
        <nav className={`bottom-navbar ${visible ? '' : 'hidden'}`}>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">📊</span>
                <span className="nav-label">대시보드</span>
            </NavLink>
            <NavLink to="/calendar" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">📅</span>
                <span className="nav-label">캘린더</span>
            </NavLink>
            <NavLink to="/screenshot" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">📸</span>
                <span className="nav-label">인증</span>
            </NavLink>
            <NavLink to="/wishlist" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">🎯</span>
                <span className="nav-label">위시리스트</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">⚙️</span>
                <span className="nav-label">설정</span>
            </NavLink>
        </nav>
    );
}

export default Navbar;
