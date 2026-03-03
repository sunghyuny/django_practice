import { useState, useEffect } from 'react';
import axios from '../api/axios';
import '../App.css';

const GAME_IDS = { '명조': 1, '니케': 2 };

function GachaPlanner() {
    const [activeTab, setActiveTab] = useState('명조');
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Form states
    const [currency, setCurrency] = useState('');
    const [tickets, setTickets] = useState('');
    const [pityStack, setPityStack] = useState('');
    const [isGuaranteed, setIsGuaranteed] = useState(false);
    const [hasMonthlyPass, setHasMonthlyPass] = useState(true);

    // ★ 목표 시점 (반 버전 단위: 0 = 현재, 1 = 다음 반, 2 = 1버전 뒤 ...)
    const [targetHalves, setTargetHalves] = useState(0);

    // ★ 명조 버전 날짜 계산
    const getWuwaVersionInfo = () => {
        const now = new Date();
        const anchorUTC = Date.UTC(2026, 1, 5); // 2026-02-05 (3.1 업데이트일)
        const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.floor((todayUTC - anchorUTC) / (1000 * 60 * 60 * 24));

        let cycleDay = (diffDays % 42) + 1;
        if (cycleDay <= 0) cycleDay += 42;

        let vMinor = 1 + Math.floor(diffDays / 42);
        let vMajor = 3 + Math.floor(vMinor / 10);
        vMinor = vMinor % 10;

        const version = `${vMajor}.${vMinor}`;
        let half, pickupDay, pickupRemaining, nextPhaseLabel;

        if (cycleDay <= 21) {
            half = '전반';
            pickupDay = cycleDay === 1 ? 0 : cycleDay - 1;
            pickupRemaining = 21 - cycleDay;
            nextPhaseLabel = `${version} 후반까지`;
        } else {
            half = '후반';
            pickupDay = cycleDay === 22 ? 0 : cycleDay - 22;
            pickupRemaining = 42 - cycleDay;
            nextPhaseLabel = `${vMajor}.${vMinor + 1 > 9 ? 0 : vMinor + 1} 전반까지`;
        }

        return { version, half, cycleDay, pickupDay, pickupRemaining, nextPhaseLabel, vMajor, vMinor };
    };

    const wuwaInfo = activeTab === '명조' ? getWuwaVersionInfo() : null;

    // ★ 미래 버전 드롭다운 옵션 생성
    const getVersionOptions = () => {
        if (!wuwaInfo) return [];
        const options = [];
        let { vMajor, vMinor, half } = wuwaInfo;

        // 현재 픽업 (0 halves)
        options.push({
            value: 0,
            label: `${vMajor}.${vMinor} ${half} (현재 픽업)`,
            income: 0,
        });

        // 앞으로 최대 10개 반버전 옵션 생성
        let currentHalf = half === '전반' ? 0 : 1; // 0 = 전반, 1 = 후반
        let curMajor = vMajor;
        let curMinor = vMinor;

        for (let i = 1; i <= 10; i++) {
            currentHalf++;
            if (currentHalf > 1) {
                currentHalf = 0;
                curMinor++;
                if (curMinor > 9) {
                    curMinor = 0;
                    curMajor++;
                }
            }
            const halfLabel = currentHalf === 0 ? '전반' : '후반';
            const versionsAhead = i / 2; // 0.5, 1, 1.5 ...
            const income = i * 10000;
            options.push({
                value: i,
                label: `${curMajor}.${curMinor} ${halfLabel} (${versionsAhead >= 1 ? versionsAhead + '버전' : '0.5버전'} 존버, +${income.toLocaleString()})`,
                income,
            });
        }
        return options;
    };

    const versionOptions = getVersionOptions();

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
                setTargetHalves(0);
            } else {
                setProfile(null);
                setCurrency(0);
                setTickets(0);
                setPityStack(0);
                setIsGuaranteed(false);
                setTargetHalves(0);
            }
        } catch (error) {
            console.error('가챠 프로필 로딩 실패:', error);
        } finally {
            setIsLoading(false);
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
            tower_avg_stars: 0,
            ruins_avg_reward: 0,
            target_date: null,
        };

        try {
            if (profile && profile.id) {
                await axios.put(`/scheduler/gacha-profiles/${profile.id}/`, payload);
            } else {
                await axios.post('/scheduler/gacha-profiles/', payload);
            }
            // ★ 목표 버전 설정을 대시보드에서도 쓸 수 있게 저장
            localStorage.setItem('ww_target_halves', String(targetHalves));
            alert('저장되었습니다.');
            fetchProfile();
        } catch (error) {
            const detail = error?.response?.data
                ? JSON.stringify(error.response.data)
                : error.message;
            console.error('저장 실패:', error);
            alert(`저장 실패: ${detail}`);
        }
    };

    // ★ 프론트엔드 계산 (버전 단위 일괄)
    const calculateResult = () => {
        if (activeTab !== '명조') return null;

        const cur = Number(currency) || 0;
        const tix = Number(tickets) || 0;
        const pity = Number(pityStack) || 0;

        // 필요 뽑기 수
        let neededPulls = 80 - pity;
        if (!isGuaranteed) neededPulls += 80; // 최악 반천장 가정 (160뽑)

        // 필요 재화 = (필요 뽑기 - 보유 티켓) * 160개 - 보유 재화
        const ticketSaves = Math.min(tix, neededPulls);
        const totalNeededCurrency = Math.max(0, (neededPulls - ticketSaves) * 160);

        // 미래 수입 (선택한 반버전 * 10,000)
        const selectedOption = versionOptions.find(o => o.value === targetHalves);
        const futureIncome = selectedOption ? selectedOption.income : 0;

        // 부족분
        const available = cur + futureIncome;
        const shortfall = Math.max(0, totalNeededCurrency - available);

        // 트럭 계산 (1트럭 = 8080개, 119,000원)
        const trucksNeeded = shortfall > 0 ? Math.ceil(shortfall / 8080) : 0;
        const costKrw = trucksNeeded * 119000;

        return {
            neededPulls,
            totalNeededCurrency,
            futureIncome,
            available,
            shortfall,
            trucksNeeded,
            costKrw,
            targetLabel: selectedOption ? selectedOption.label : '',
        };
    };

    const result = calculateResult();

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

                    {/* ★ 명조 버전 현황 카드 */}
                    {wuwaInfo && (
                        <div className="gacha-card" style={{ background: 'linear-gradient(135deg, rgba(255, 177, 66, 0.08), rgba(0, 210, 255, 0.08))', border: '1px solid rgba(255, 177, 66, 0.25)' }}>
                            <h3 style={{ color: '#ffb142' }}>🌊 명조 {wuwaInfo.version} {wuwaInfo.half} 픽업</h3>
                            <div className="plan-stats">
                                <div className="stat-row">
                                    <span>현재 버전</span>
                                    <strong style={{ color: '#ffb142' }}>{wuwaInfo.version} {wuwaInfo.half}</strong>
                                </div>
                                <div className="stat-row">
                                    <span>픽업 진행일</span>
                                    <strong>{wuwaInfo.pickupDay === 0 ? '점검일 (업데이트)' : `${wuwaInfo.pickupDay}일째`}</strong>
                                </div>
                                <div className="stat-row">
                                    <span>남은 일수</span>
                                    <strong style={{ color: wuwaInfo.pickupRemaining <= 5 ? '#ff6b6b' : '#4ecdc4' }}>
                                        {wuwaInfo.pickupRemaining}일 ({wuwaInfo.nextPhaseLabel})
                                    </strong>
                                </div>
                                <div className="stat-row">
                                    <span>42일 주기</span>
                                    <strong>{wuwaInfo.cycleDay}/42일차</strong>
                                </div>
                            </div>
                            <div style={{ marginTop: '10px', background: '#1a1a2e', borderRadius: '8px', overflow: 'hidden', height: '8px' }}>
                                <div style={{
                                    width: `${(wuwaInfo.cycleDay / 42) * 100}%`,
                                    height: '100%',
                                    background: wuwaInfo.half === '전반' ? 'linear-gradient(90deg, #00d2ff, #3a7bd5)' : 'linear-gradient(90deg, #ffb142, #ff6b6b)',
                                    borderRadius: '8px',
                                    transition: 'width 0.5s ease',
                                }} />
                            </div>
                        </div>
                    )}

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
                                        월정액 구독 중
                                    </label>
                                </div>
                            </>
                        )}

                        {/* ★ 목표 픽업 시점 (버전 드롭다운) */}
                        {activeTab === '명조' && versionOptions.length > 0 && (
                            <div className="input-group" style={{ marginTop: '15px' }}>
                                <label style={{ color: '#ffc107' }}>🎯 목표 픽업 시점</label>
                                <select
                                    value={targetHalves}
                                    onChange={e => setTargetHalves(Number(e.target.value))}
                                    style={{ width: '100%', background: '#2a2a2a', border: '1px solid #444', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}
                                >
                                    {versionOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button onClick={handleSave} className="submit-btn" style={{ marginTop: '15px' }}>프로필 저장하기</button>
                    </div>

                    {/* ★ 계산 결과 (실시간) */}
                    {result && (
                        <div className="gacha-card result-card">
                            <h3>📊 뽑기 견적 분석</h3>

                            <div className="plan-stats">
                                <div className="stat-row">
                                    <span>필요 뽑기 수</span>
                                    <strong>{result.neededPulls}뽑 {isGuaranteed ? '(확정)' : '(최악 가정)'}</strong>
                                </div>
                                <div className="stat-row">
                                    <span>필요 재화 (티켓 제외)</span>
                                    <strong>{result.totalNeededCurrency.toLocaleString()}</strong>
                                </div>
                                <div className="stat-row" style={{ color: '#4ecdc4' }}>
                                    <span>보유 재화</span>
                                    <strong>{Number(currency || 0).toLocaleString()}</strong>
                                </div>
                                {targetHalves > 0 && (
                                    <div className="stat-row" style={{ color: '#4ecdc4' }}>
                                        <span>존버 수입 ({targetHalves * 0.5}버전)</span>
                                        <strong>+{result.futureIncome.toLocaleString()}</strong>
                                    </div>
                                )}
                                <div className="stat-row" style={{ color: result.shortfall > 0 ? '#ff6b6b' : '#4ecdc4', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
                                    <span>최종 부족 재화</span>
                                    <strong>{result.shortfall > 0 ? result.shortfall.toLocaleString() : '0 (충분!)'}</strong>
                                </div>
                            </div>

                            {result.shortfall === 0 ? (
                                <div className="plan-success">
                                    🎉 {targetHalves === 0 ? '지금 바로' : '존버하면'} 무과금 확정 획득 가능합니다!
                                </div>
                            ) : (
                                <div className="plan-warning">
                                    <p>⚠️ 추가 과금이 필요합니다.</p>
                                    <div className="truck-box">
                                        <span className="truck-icon">🚚</span>
                                        <div className="truck-info">
                                            <strong>약 {result.trucksNeeded} 트럭 충전 필요</strong>
                                            <span>(최소 {result.costKrw.toLocaleString()}원)</span>
                                        </div>
                                    </div>
                                    <small>*깡트럭(8,080개/119,000원) 기준 보수적 계산</small>
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
