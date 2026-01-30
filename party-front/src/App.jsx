import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Register from './components/Register';
import SpendingHistory from './components/SpendingHistory';
import './App.css';



// 메인 페이지 (Landing)
function MainPage() {
  return (
    <div className="main-container">
      <h1>Nukki Project</h1>
      <p>어서오세요. 게이머를 위한 비서, 누끼입니다.</p>
      <div className="main-buttons">
        <a href="/login"><button>로그인</button></a>
        <a href="/register"><button className="secondary">회원가입</button></a>
        <a href="/dashboard"><button className="outline">대시보드 둘러보기 ({'>'})</button></a>
      </div>
    </div>
  );
}


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/history" element={<SpendingHistory />} />


      </Routes>
    </BrowserRouter>
  );
}

export default App;