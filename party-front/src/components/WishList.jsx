import { useState, useEffect } from 'react';
import axios from '../api/axios';

const GAME_IDS = { '명조': 1, '니케': 2 };

function WishList() {
    const [goals, setGoals] = useState([]);
    const [activeTab, setActiveTab] = useState('명조');
    const [showForm, setShowForm] = useState(false);
    const [savingsModal, setSavingsModal] = useState(null); // goal id
    const [savingsAmount, setSavingsAmount] = useState('');
    const [celebration, setCelebration] = useState(null);

    // 새 목표 폼
    const [newItem, setNewItem] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newDate, setNewDate] = useState('');

    useEffect(() => { fetchGoals(); }, []);

    const fetchGoals = async () => {
        try {
            const res = await axios.get('/scheduler/saving-goals/');
            setGoals(Array.isArray(res.data) ? res.data : res.data.results || []);
        } catch (e) {
            console.error('위시리스트 로딩 실패:', e);
        }
    };

    const handleAddGoal = async () => {
        if (!newItem || !newTarget) return alert('아이템 이름과 목표 금액을 입력해주세요!');
        try {
            await axios.post('/scheduler/saving-goals/', {
                item_name: newItem,
                target_amount: parseInt(newTarget),
                game: GAME_IDS[activeTab],
                target_date: newDate || null,
            });
            setNewItem(''); setNewTarget(''); setNewDate('');
            setShowForm(false);
            fetchGoals();
        } catch (e) {
            console.error('목표 추가 실패:', e);
            alert('목표 추가 중 문제가 발생했습니다.');
        }
    };

    const handleAddSavings = async (goalId) => {
        if (!savingsAmount) return alert('저축 금액을 입력해주세요!');
        try {
            const res = await axios.post(`/scheduler/saving-goals/${goalId}/add_savings/`, {
                amount: parseInt(savingsAmount),
            });
            if (res.data.goal?.is_achieved) {
                setCelebration(res.data.goal.item_name);
                setTimeout(() => setCelebration(null), 3000);
            }
            setSavingsModal(null);
            setSavingsAmount('');
            fetchGoals();
        } catch (e) {
            console.error('저축 실패:', e);
            alert(e.response?.data?.error || '저축 중 문제가 발생했습니다.');
        }
    };

    const handleDelete = async (goalId) => {
        if (!confirm('정말 이 목표를 삭제하시겠습니까?')) return;
        try {
            await axios.delete(`/scheduler/saving-goals/${goalId}/`);
            fetchGoals();
        } catch (e) {
            console.error('삭제 실패:', e);
        }
    };

    const filteredGoals = goals.filter(g => g.game_name === activeTab);
    const activeGoals = filteredGoals.filter(g => !g.is_achieved);
    const achievedGoals = filteredGoals.filter(g => g.is_achieved);

    return (
        <div className="container dashboard-container">
            <div className="dashboard-header">
                <h2>🎯 위시리스트</h2>
            </div>

            {/* 축하 오버레이 */}
            {celebration && (
                <div className="celebration-overlay">
                    <div className="celebration-content">
                        <div className="celebration-emoji">🎉🎊✨</div>
                        <h2>목표 달성!</h2>
                        <p><strong>{celebration}</strong> 저축 목표를 달성했습니다!</p>
                    </div>
                </div>
            )}

            <div className="tabs">
                <button className={`tab-btn ww ${activeTab === '명조' ? 'active' : ''}`} onClick={() => setActiveTab('명조')}>🌊 명조</button>
                <button className={`tab-btn nikke ${activeTab === '니케' ? 'active' : ''}`} onClick={() => setActiveTab('니케')}>🍑 니케</button>
            </div>

            {/* 새 목표 추가 버튼 */}
            <button className="add-goal-btn" onClick={() => setShowForm(!showForm)}>
                {showForm ? '닫기' : '+ 새 목표 추가'}
            </button>

            {showForm && (
                <div className="goal-form">
                    <input type="text" placeholder="아이템 이름 (예: 신염의 율자 스킨)" value={newItem} onChange={e => setNewItem(e.target.value)} />
                    <input type="number" placeholder="목표 금액 (원)" value={newTarget} onChange={e => setNewTarget(e.target.value)} />
                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                    <button onClick={handleAddGoal} className="submit-btn">목표 등록</button>
                </div>
            )}

            {/* 진행 중인 목표 */}
            <div className="section-title">🔥 진행 중</div>
            {activeGoals.length === 0 && <div className="empty-msg">아직 목표가 없습니다. 새 목표를 추가해보세요!</div>}
            {activeGoals.map(goal => (
                <div key={goal.id} className="goal-card">
                    <div className="goal-header">
                        <div className="goal-name">{goal.item_name}</div>
                        <button className="delete-btn" onClick={() => handleDelete(goal.id)}>✕</button>
                    </div>
                    <div className="goal-amounts">
                        <span className="saved">{goal.saved_amount?.toLocaleString()}원</span>
                        <span className="target"> / {goal.target_amount?.toLocaleString()}원</span>
                    </div>
                    <div className="progress-bar-container">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${goal.progress_percent || 0}%` }}
                        >
                            <span className="progress-text">{goal.progress_percent || 0}%</span>
                        </div>
                    </div>
                    {goal.target_date && <div className="goal-date">📅 목표일: {goal.target_date}</div>}
                    <button className="savings-btn" onClick={() => { setSavingsModal(goal.id); setSavingsAmount(''); }}>
                        💰 저축하기
                    </button>

                    {/* 저축 입력 모달 */}
                    {savingsModal === goal.id && (
                        <div className="savings-input">
                            <input type="number" placeholder="저축 금액" value={savingsAmount} onChange={e => setSavingsAmount(e.target.value)} autoFocus />
                            <button onClick={() => handleAddSavings(goal.id)}>확인</button>
                            <button onClick={() => setSavingsModal(null)} className="cancel-btn">취소</button>
                        </div>
                    )}
                </div>
            ))}

            {/* 달성 완료 */}
            {achievedGoals.length > 0 && (
                <>
                    <div className="section-title">✅ 달성 완료</div>
                    {achievedGoals.map(goal => (
                        <div key={goal.id} className="goal-card achieved">
                            <div className="goal-header">
                                <div className="goal-name">{goal.item_name} 🎉</div>
                                <button className="delete-btn" onClick={() => handleDelete(goal.id)}>✕</button>
                            </div>
                            <div className="goal-amounts">
                                <span className="saved">{goal.saved_amount?.toLocaleString()}원</span>
                                <span className="target"> / {goal.target_amount?.toLocaleString()}원</span>
                            </div>
                            <div className="progress-bar-container">
                                <div className="progress-bar-fill complete" style={{ width: '100%' }}>
                                    <span className="progress-text">달성! 🏆</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

export default WishList;
