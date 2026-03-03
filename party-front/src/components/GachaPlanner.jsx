import { useState, useEffect } from 'react';
import axios from '../api/axios';
import '../App.css';

const GAME_IDS = { '명조': 1, '니케': 2 };

function GachaPlanner() {
    const [activeTab, setActiveTab] = useState('명조');
    const [profile, setProfile] = useState(null);
    const [plan, setPlan] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Form states
    const [currency, setCurrency] = useState('');
    const [tickets, setTickets] = useState('');
    const [pityStack, setPityStack] = useState('');
    const [isGuaranteed, setIsGuaranteed] = useState(false);

    // 명조 전용 설정
    const [hasMonthlyPass, setHasMonthlyPass] = useState(true);
    const [towerStars, setTowerStars] = useState(800);
    const [ruinsReward, setRuinsReward] = useState(800);

    const [targetDate, setTargetDate] = useState('');

    useEffect(() => {
        fetchProfile();
    }, [activeTab]);

    const fetchProfile = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get('/scheduler/gacha-profiles/');
            const userProfiles = Array.isArray(res.data) ? res.data : res.data.results || [];
            const currentProfile = userProfiles.find(p => p.game_name === activeTab);

            if (currentProfile) {
                setProfile(currentProfile);
                setCurrency(currentProfile.currency || 0);
                setTickets(currentProfile.tickets || 0);
                setPityStack(currentProfile.pity_stack || 0);
                setIsGuaranteed(currentProfile.is_guaranteed);
                setHasMonthlyPass(currentProfile.has_monthly_pass);
                setTowerStars(currentProfile.tower_avg_stars);
                setRuinsReward(currentProfile.ruins_avg_reward);
                setTargetDate(currentProfile.target_date || '');

                if (currentProfile.target_date) {
                    fetchPlan(currentProfile.game);
                }
            } else {
                // Reset form if no profile
                setProfile(null);
                setPlan(null);
                setCurrency(0);
                setTickets(0);
                setPityStack(0);
                setIsGuaranteed(false);
                setTargetDate('');
            }
        } catch (error) {
            console.error('가챠 프로필 로딩 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPlan = async (gameId) => {
        try {
            const res = await axios.get(`/scheduler/gacha-profiles/calculate_plan/?game_id=${gameId}`);
            setPlan(res.data);
        } catch (error) {
            console.error('플랜 계산 실패:', error);
            setPlan(null);
        }
    };

    const handleSave = async () => {
        const gameId = GAME_IDS[activeTab];
        const payload = {
            game: gameId,
            currency: Number(currency),
            tickets: Number(tickets),
            pity_stack: Number(pityStack),
            is_guaranteed: isGuaranteed,
            has_monthly_pass: hasMonthlyPass,
            tower_avg_stars: Number(towerStars),
            ruins_avg_reward: Number(ruinsReward),
            target_date: targetDate || null
        };

        try {
            if (profile && profile.id) {
                await axios.put(`/scheduler/gacha-profiles/${profile.id}/`, payload);
            } else {
                await axios.post('/scheduler/gacha-profiles/', payload);
            }
            alert('저장되었습니다.');
            fetchProfile(); // Re-fetch and calculate
        } catch (error) {
            console.error('저장 실패:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="container dashboard-container">
            <div className="dashboard-header">
                <h2>🎰 가챠 스케줄러</h2>
            </div>

            <div className="game-tabs">
                {Object.keys(GAME_IDS).map(game => (
                    <button
                        key={game}
                        className={`tab-btn ${activeTab === game ? 'active' : ''}`}
                        onClick={() => setActiveTab(game)}
                    >
                        {game === '명조' ? '🌊 명조' : '🍑 니케'}
                    </button>
                ))}
            </div>

            {isLoading ? <p style={{ textAlign: 'center', marginTop: '20px' }}>로딩 중...</p> : (
                <div className="gacha-grid">
                    {/* 설정 폼 */}
                    <div className="gacha-card">
                        <h3>현재 상태 입력</h3>

                        <div className="input-group">
                            <label>{activeTab === '명조' ? '별의소리' : '쥬얼'} 보유량</label>
                            <input type="number" value={currency} onChange={e => setCurrency(e.target.value)} />
                        </div>

                        <div className="input-group">
                            <label>픽업 티켓 (무늬/모집권)</label>
                            <input type="number" value={tickets} onChange={e => setTickets(e.target.value)} />
                        </div>

                        <div className="input-group">
                            <label>{activeTab === '명조' ? '현재 스택 (0~80)' : '골드 마일리지'}</label>
                            <input type="number" value={pityStack} onChange={e => setPityStack(e.target.value)} />
                        </div>

                        {activeTab === '명조' && (
                            <>
                                <div className="checkbox-group">
                                    <label>
                                        <input type="checkbox" checked={isGuaranteed} onChange={e => setIsGuaranteed(e.target.checked)} />
                                        다음 확천장 여부 (이전 픽뚫)
                                    </label>
                                </div>
                                <div className="checkbox-group">
                                    <label>
                                        <input type="checkbox" checked={hasMonthlyPass} onChange={e => setHasMonthlyPass(e.target.checked)} />
                                        월정액 구독 중 (일 90개 추가)
                                    </label>
                                </div>

                                <div className="input-group">
                                    <label>역경의 탑 예상 획득 (1주기 평균)</label>
                                    <input type="number" value={towerStars} onChange={e => setTowerStars(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>바닷속 폐허 예상 획득 (월간 평균)</label>
                                    <input type="number" value={ruinsReward} onChange={e => setRuinsReward(e.target.value)} />
                                </div>
                            </>
                        )}

                        <div className="input-group" style={{ marginTop: '15px' }}>
                            <label style={{ color: '#ffc107' }}>목표 픽업 종료일 (D-Day)</label>
                            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
                        </div>

                        <button onClick={handleSave} className="submit-btn" style={{ marginTop: '15px' }}>계산 및 저장하기</button>
                    </div>

                    {/* 계산 결과 */}
                    {plan && (
                        <div className="gacha-card result-card">
                            <h3>📊 수집 계획 분석</h3>
                            {plan.days_remaining > 0 ? (
                                <p className="d-day-text">목표일까자 <strong>D-{plan.days_remaining}</strong></p>
                            ) : (
                                <p className="d-day-text" style={{ color: '#ff6b6b' }}>픽업이 오늘 종료되거나 이미 지났습니다!</p>
                            )}

                            <div className="plan-stats">
                                <div className="stat-row">
                                    <span>필요 총 재화</span>
                                    <strong>{plan.total_needed_currency.toLocaleString()}</strong>
                                </div>
                                <div className="stat-row" style={{ color: '#4ecdc4' }}>
                                    <span>예상 자연 획득량</span>
                                    <strong>+{plan.expected_income.toLocaleString()}</strong>
                                </div>
                                <div className="stat-row" style={{ color: '#ff6b6b', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
                                    <span>최종 부족 재화</span>
                                    <strong>{plan.shortfall.toLocaleString()}</strong>
                                </div>
                            </div>

                            {plan.shortfall === 0 ? (
                                <div className="plan-success">
                                    🎉 이대로 숨만 쉬어도 무과금 확정 획득 가능합니다!
                                </div>
                            ) : (
                                <div className="plan-warning">
                                    <p>⚠️ 명함 획득을 위해 추가 과금이 필요합니다.</p>
                                    <div className="truck-box">
                                        <span className="truck-icon">🚚</span>
                                        <div className="truck-info">
                                            <strong>약 {plan.trucks_needed} 트럭 충전 필요</strong>
                                            <span>(최소 {plan.cost_krw.toLocaleString()}원)</span>
                                        </div>
                                    </div>
                                    <small>*초회 및 기타 패키지 효율 미적용, 깡트럭 기준 보수적 계산</small>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default GachaPlanner;
