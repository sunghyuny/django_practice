import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';

function Settings() {
    const navigate = useNavigate();
    const [webhookUrl, setWebhookUrl] = useState('');
    const [saved, setSaved] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const user = JSON.parse(localStorage.getItem('user_info') || '{}');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await axios.get('/account/me/');
            setWebhookUrl(res.data.discord_webhook_url || '');
        } catch (e) {
            console.error('프로필 로딩 실패:', e);
        }
    };

    const handleSaveWebhook = async () => {
        try {
            await axios.patch('/account/me/', { discord_webhook_url: webhookUrl });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            alert('저장에 실패했습니다.');
        }
    };

    const handleTestNotify = async () => {
        setLoading(true);
        setTestResult(null);
        try {
            const res = await axios.post('/scheduler/tasks/send_reminder/');
            setTestResult({ success: true, message: res.data.message });
        } catch (e) {
            setTestResult({
                success: false,
                message: e.response?.data?.error || '알림 전송에 실패했습니다.'
            });
        }
        setLoading(false);
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_info');
        localStorage.removeItem('mySpendingData');
        navigate('/login');
    };

    return (
        <div className="container dashboard-container">
            <div className="dashboard-header">
                <h2>⚙️ 설정</h2>
            </div>

            {/* 프로필 섹션 */}
            <div className="settings-card">
                <div className="settings-section-title">👤 프로필</div>
                <div className="settings-info">
                    <div className="settings-row">
                        <span className="settings-label">닉네임</span>
                        <span className="settings-value">{user.nickname || '-'}</span>
                    </div>
                    <div className="settings-row">
                        <span className="settings-label">이메일</span>
                        <span className="settings-value">{user.email || '-'}</span>
                    </div>
                </div>
            </div>

            {/* 디스코드 알림 설정 */}
            <div className="settings-card">
                <div className="settings-section-title">🤖 디스코드 알림</div>
                <p className="settings-desc">
                    디스코드 Webhook URL을 등록하면, 미완료 숙제 알림을 디스코드로 받을 수 있습니다.
                </p>

                <div className="webhook-form">
                    <input
                        type="url"
                        placeholder="https://discord.com/api/webhooks/..."
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        className="webhook-input"
                    />
                    <button onClick={handleSaveWebhook} className="save-btn">
                        {saved ? '✅ 저장됨!' : '저장'}
                    </button>
                </div>

                {webhookUrl && (
                    <button
                        onClick={handleTestNotify}
                        disabled={loading}
                        className="test-btn"
                    >
                        {loading ? '전송 중...' : '🔔 테스트 알림 보내기'}
                    </button>
                )}

                {testResult && (
                    <div className={`result-message ${testResult.success ? 'success' : 'error'}`}>
                        {testResult.message}
                    </div>
                )}
            </div>

            {/* 로그아웃 */}
            <div className="settings-card">
                <button onClick={handleLogout} className="logout-btn">🚪 로그아웃</button>
            </div>
        </div>
    );
}

export default Settings;
