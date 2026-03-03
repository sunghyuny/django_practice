import { useState, useEffect } from 'react'
import axios from '../api/axios'
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
);

const GAME_IDS = { '명조': 1, '니케': 2 };

const DEFAULT_CATEGORIES = [
    { code: 'MONTHLY', name: '월정액' },
    { code: 'BP', name: '패스 (Battle Pass)' },
    { code: 'PACK', name: '패키지/트럭' },
    { code: 'SKIN', name: '스킨/코스튬' },
];

function Dashboard() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([])
    const [doneIds, setDoneIds] = useState([])
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
    const [activeTab, setActiveTab] = useState('명조')
    const [spending, setSpending] = useState({ total: 0, breakdown: { ww: 0, nikke: 0 }, category_breakdown: {} });
    const [spendingTrend, setSpendingTrend] = useState([]);
    const [newAmount, setNewAmount] = useState('');
    const [newCategory, setNewCategory] = useState('MONTHLY');
    const [showSeasonForm, setShowSeasonForm] = useState(false);
    const [newSeasonTitle, setNewSeasonTitle] = useState('');
    const [newSeasonType, setNewSeasonType] = useState('FOUR_WEEKS');
    const [newSeasonDueDate, setNewSeasonDueDate] = useState('');
    const [gachaProfile, setGachaProfile] = useState(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [taskRes, spendSummaryRes, trendRes, statusRes, gachaRes] = await Promise.all([
                axios.get('/scheduler/tasks/'),
                axios.get('/scheduler/spendings/monthly_summary/'),
                axios.get('/scheduler/spendings/spending_trend/'),
                axios.get('/scheduler/tasks/today_status/'),
                axios.get('/scheduler/gacha-profiles/').catch(() => ({ data: [] })),
            ]);
            setTasks(Array.isArray(taskRes.data) ? taskRes.data : taskRes.data.results);
            setSpending(spendSummaryRes.data);
            setSpendingTrend(trendRes.data || []);
            const doneTaskIds = (statusRes.data || []).filter(s => s.is_done).map(s => s.task_id);
            setDoneIds(doneTaskIds);
            const profiles = Array.isArray(gachaRes.data) ? gachaRes.data : gachaRes.data.results || [];
            setGachaProfile(profiles.find(p => p.game_name === '명조') || null);
        } catch (error) {
            console.error("로딩 실패:", error);
        }
    }

    const handleToggle = async (taskId) => {
        if (doneIds.includes(taskId)) {
            setDoneIds(doneIds.filter(id => id !== taskId));
        } else {
            setDoneIds([...doneIds, taskId]);
            try { await axios.post('/scheduler/logs/', { task: taskId }); }
            catch (e) { setDoneIds(prev => prev.filter(id => id !== taskId)); }
        }
    }

    const handleAddSpending = async () => {
        if (!newAmount) return alert("금액을 입력해주세요!");
        const amountNum = parseInt(newAmount);
        const gameId = GAME_IDS[activeTab];
        const selectedCat = categories.find(cat => cat.code === newCategory);
        const key = activeTab === '명조' ? 'ww' : 'nikke';
        setSpending(prev => ({ ...prev, total: prev.total + amountNum, breakdown: { ...prev.breakdown, [key]: prev.breakdown[key] + amountNum } }));
        setNewAmount('');
        try {
            await axios.post('/scheduler/spendings/', { item_name: selectedCat?.name || '기타', amount: amountNum, game: gameId, purchased_at: new Date().toISOString().split('T')[0], category: newCategory });
            fetchData();
        } catch (error) {
            setSpending(prev => ({ ...prev, total: prev.total - amountNum, breakdown: { ...prev.breakdown, [key]: prev.breakdown[key] - amountNum } }));
            alert("오류 발생!");
        }
    }

    const handleAddSeasonTask = async () => {
        if (!newSeasonTitle) return alert("콘텐츠 이름을 입력해주세요.");
        try {
            await axios.post('/scheduler/tasks/', { title: newSeasonTitle, game: GAME_IDS[activeTab], reset_type: newSeasonType, due_date: newSeasonDueDate || null, priority: 1 });
            setNewSeasonTitle(''); setNewSeasonDueDate(''); setShowSeasonForm(false); fetchData();
        } catch (error) { alert("일정 추가 중 문제가 발생했습니다."); }
    }

    const filteredTasks = tasks.filter(task => task.game_name === activeTab);
    const seasonTasks = filteredTasks.filter(t => ['FOUR_WEEKS', 'PATCH', 'BIWEEKLY', 'MONTHLY'].includes(t.reset_type));
    const user = JSON.parse(localStorage.getItem('user_info') || '{}');

    // ★ 명조 버전 날짜 계산
    const getWuwaVersionInfo = () => {
        const now = new Date();
        const anchorUTC = Date.UTC(2026, 1, 5);
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
            half = '전반'; pickupDay = cycleDay === 1 ? 0 : cycleDay - 1; pickupRemaining = 21 - cycleDay; nextPhaseLabel = `${version} 후반`;
        } else {
            half = '후반'; pickupDay = cycleDay === 22 ? 0 : cycleDay - 22; pickupRemaining = 42 - cycleDay; nextPhaseLabel = `${vMajor}.${vMinor + 1 > 9 ? 0 : vMinor + 1} 전반`;
        }
        return { version, half, cycleDay, pickupDay, pickupRemaining, nextPhaseLabel };
    };
    const wuwaInfo = getWuwaVersionInfo();

    // ★ 가챠 견적 계산 (GachaPlanner의 목표 버전 설정 반영)
    const getGachaEstimate = () => {
        if (!gachaProfile) return null;
        const cur = gachaProfile.currency || 0, tix = gachaProfile.tickets || 0, pity = gachaProfile.pity_stack || 0, guaranteed = gachaProfile.is_guaranteed;
        // GachaPlanner에서 저장한 목표 버전(반버전 단위) 읽기
        const targetHalves = parseInt(localStorage.getItem('ww_target_halves') || '0');
        const futureIncome = targetHalves * 10000; // 반버전당 10,000
        const totalCur = cur + futureIncome;

        let neededPulls = 80 - pity;
        if (!guaranteed) neededPulls += 80;
        const ticketSaves = Math.min(tix, neededPulls);
        const totalNeeded = Math.max(0, (neededPulls - ticketSaves) * 160);
        const shortfall = Math.max(0, totalNeeded - totalCur);
        const trucks = shortfall > 0 ? Math.ceil(shortfall / 8080) : 0;
        return { neededPulls, shortfall, trucks, cost: trucks * 119000, currency: cur, futureIncome, totalCur, tickets: tix, pity, guaranteed, targetHalves };
    };

    const gachaEstimate = getGachaEstimate();

    // ★ 목표 픽업 레이블 계산
    const getTargetPickupLabel = () => {
        if (!wuwaInfo) return null;
        const th = parseInt(localStorage.getItem('ww_target_halves') || '0');
        if (th === 0) return `${wuwaInfo.version} ${wuwaInfo.half} (현재 픽업)`;
        let { vMajor, vMinor, half } = (() => {
            // wuwaInfo에서 현재 major/minor 추출
            const [maj, min] = wuwaInfo.version.split('.').map(Number);
            return { vMajor: maj, vMinor: min, half: wuwaInfo.half };
        })();
        let h = half === '전반' ? 0 : 1;
        for (let i = 0; i < th; i++) {
            h++;
            if (h >= 2) { h = 0; vMinor++; }
            if (vMinor >= 10) { vMinor = 0; vMajor++; }
        }
        const targetHalf = h === 0 ? '전반' : '후반';
        return `${vMajor}.${vMinor} ${targetHalf}`;
    };
    const targetPickupLabel = getTargetPickupLabel();

    // 차트 데이터
    const barData = { labels: ['명조', '니케'], datasets: [{ label: '지출', data: [spending.breakdown.ww, spending.breakdown.nikke], backgroundColor: ['#00e5ff', '#ff3333'], borderRadius: 5 }] };
    const barOpts = { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, title: { display: true, text: '게임별', color: '#888', font: { size: 11 } } }, scales: { y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#888', font: { size: 9 } } }, x: { grid: { display: false }, ticks: { color: '#888', font: { size: 9 } } } } };

    const catBreakdown = spending.category_breakdown || {};
    const catLabels = Object.values(catBreakdown).map(c => c.name);
    const catValues = Object.values(catBreakdown).map(c => c.total);
    const catDoughnut = { labels: catLabels.length ? catLabels : ['없음'], datasets: [{ data: catValues.length ? catValues : [1], backgroundColor: catValues.length ? ['#ff6384', '#36a2eb', '#ffce56', '#9966ff'] : ['#333'], borderWidth: 0 }] };

    const trendLabels = spendingTrend.map(m => m.label);
    const trendValues = spendingTrend.map(m => m.total);
    const lineData = { labels: trendLabels, datasets: [{ label: '월별', data: trendValues, borderColor: '#00d2ff', backgroundColor: 'rgba(0,210,255,0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#00d2ff', pointRadius: 2 }] };
    const lineOpts = { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, title: { display: true, text: '6개월 추이', color: '#888', font: { size: 11 } } }, scales: { y: { beginAtZero: true, grid: { color: '#222' }, ticks: { color: '#888', font: { size: 9 } } }, x: { grid: { display: false }, ticks: { color: '#888', font: { size: 9 } } } } };

    const cs = { card: { background: '#1a1a2e', border: '1px solid #333', borderRadius: '10px', padding: '20px', minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } };

    return (
        <div className="container dashboard-container" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>📊 Dashboard <span className="user-badge">{user.nickname || '게이머'}님</span></h2>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button className={`tab-btn ww ${activeTab === '명조' ? 'active' : ''}`} onClick={() => setActiveTab('명조')} style={{ padding: '4px 14px', fontSize: '0.8rem' }}>🌊 명조</button>
                    <button className={`tab-btn nikke ${activeTab === '니케' ? 'active' : ''}`} onClick={() => setActiveTab('니케')} style={{ padding: '4px 14px', fontSize: '0.8rem' }}>🍑 니케</button>
                </div>
            </div>

            {/* ★ 1행: 픽업 + 견적 + 지출 가로 3열 */}
            <div className="dash-grid-3">
                {activeTab === '명조' && wuwaInfo && (
                    <div style={{ ...cs.card, background: 'linear-gradient(135deg, rgba(255,177,66,0.08), rgba(0,210,255,0.08))', border: '1px solid rgba(255,177,66,0.25)' }}>
                        <div style={{ color: '#ffb142', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '10px' }}>🌊 {wuwaInfo.version} {wuwaInfo.half}</div>
                        <div style={{ fontSize: '1rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>진행</span><strong>{wuwaInfo.pickupDay === 0 ? '점검일' : `${wuwaInfo.pickupDay}일째`}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>남은</span><strong style={{ color: wuwaInfo.pickupRemaining <= 5 ? '#ff6b6b' : '#4ecdc4' }}>{wuwaInfo.pickupRemaining}일</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>주기</span><strong>{wuwaInfo.cycleDay}/42</strong></div>
                        </div>
                        <div style={{ marginTop: '6px', background: '#1a1a2e', borderRadius: '4px', overflow: 'hidden', height: '4px' }}>
                            <div style={{ width: `${(wuwaInfo.cycleDay / 42) * 100}%`, height: '100%', background: wuwaInfo.half === '전반' ? 'linear-gradient(90deg,#00d2ff,#3a7bd5)' : 'linear-gradient(90deg,#ffb142,#ff6b6b)', borderRadius: '4px' }} />
                        </div>
                    </div>
                )}

                {activeTab === '명조' && (
                    gachaEstimate ? (
                        <div style={cs.card}>
                            {/* 목표 픽업 표시 */}
                            {targetPickupLabel && (
                                <div style={{ fontSize: '0.75rem', color: '#ffb142', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    🎯 <span style={{ fontWeight: 'bold' }}>목표 픽업:</span> {targetPickupLabel}
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>🎰 견적</span>
                                <button onClick={() => navigate('/gacha')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline' }}>상세&gt;</button>
                            </div>
                            <div style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>보유</span>
                                    <strong>{gachaEstimate.currency.toLocaleString()}
                                        {gachaEstimate.futureIncome > 0 && <span style={{ color: '#4ecdc4', marginLeft: '4px' }}>+{gachaEstimate.futureIncome.toLocaleString()}</span>}
                                    </strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>필요</span><strong>{gachaEstimate.neededPulls}뽑 {gachaEstimate.guaranteed ? '확정' : '최악'}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: gachaEstimate.shortfall > 0 ? '#ff6b6b' : '#4ecdc4' }}><span>부족</span><strong>{gachaEstimate.shortfall > 0 ? gachaEstimate.shortfall.toLocaleString() : '0 ✅'}</strong></div>
                            </div>
                            <div style={{ marginTop: '6px', borderRadius: '5px', padding: '3px 6px', fontSize: '0.72rem', textAlign: 'center', background: gachaEstimate.shortfall > 0 ? 'rgba(255,107,107,0.1)' : 'rgba(76,175,80,0.1)', color: gachaEstimate.shortfall > 0 ? '#ff6b6b' : '#4caf50' }}>
                                {gachaEstimate.shortfall > 0 ? `🚚 ${gachaEstimate.trucks}트럭 (${gachaEstimate.cost.toLocaleString()}원)` : '🎉 무과금 확정!'}
                            </div>
                        </div>
                    ) : (
                        <div style={{ ...cs.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <button onClick={() => navigate('/gacha')} style={{ background: '#333', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>🎰 설정하기</button>
                        </div>
                    )
                )}

                {/* 지출 */}
                <div style={cs.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>💰 {activeTab} 이번 달</span>
                        <button onClick={() => navigate('/history')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline' }}>관리&gt;</button>
                    </div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', textAlign: 'center', margin: '2px 0 6px' }}>
                        {(activeTab === '명조' ? spending.breakdown.ww : spending.breakdown.nikke).toLocaleString()}원
                    </div>
                    <div style={{ display: 'flex', gap: '3px' }}>
                        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ flex: 1, background: '#2a2a2a', border: '1px solid #444', color: '#fff', padding: '5px', borderRadius: '4px', fontSize: '0.72rem' }}>
                            {categories.map((cat) => <option key={cat.code} value={cat.code}>{cat.name}</option>)}
                        </select>
                        <input type="number" placeholder="금액" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} style={{ width: '55px', background: '#2a2a2a', border: '1px solid #444', color: '#fff', padding: '5px', borderRadius: '4px', fontSize: '0.72rem' }} />
                        <button onClick={handleAddSpending} style={{ background: '#00e5ff', color: '#000', border: 'none', borderRadius: '4px', padding: '5px 8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.72rem' }}>등록</button>
                    </div>
                </div>
            </div>

            {/* ★ 2행: 차트 3열 */}
            <div className="dash-grid-3" style={{ marginBottom: '20px' }}>
                <div className="chart-card" style={{ padding: '20px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bar options={{ ...barOpts, maintainAspectRatio: false }} data={barData} />
                </div>
                <div className="chart-card" style={{ padding: '20px', height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '0.9rem', color: '#888', textAlign: 'center', marginBottom: '10px' }}>카테고리별</div>
                    <Doughnut data={catDoughnut} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#888', font: { size: 12 }, boxWidth: 12 } } } }} />
                </div>
                <div className="chart-card" style={{ padding: '20px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Line options={{ ...lineOpts, maintainAspectRatio: false }} data={lineData} />
                </div>
            </div>

            {/* ★ 3행: 엔드 콘텐츠 */}
            <div style={{ marginTop: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>🔥 엔드 콘텐츠</span>
                    <button onClick={() => setShowSeasonForm(!showSeasonForm)} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>
                        {showSeasonForm ? '닫기' : '+ 추가'}
                    </button>
                </div>

                {showSeasonForm && (
                    <div style={{ marginBottom: '8px', background: '#222', padding: '6px', borderRadius: '6px', display: 'flex', gap: '4px' }}>
                        <input type="text" placeholder="이름" value={newSeasonTitle} onChange={(e) => setNewSeasonTitle(e.target.value)} style={{ flex: 2, padding: '5px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: '#fff', fontSize: '0.78rem' }} />
                        <select value={newSeasonType} onChange={(e) => setNewSeasonType(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: '#fff', fontSize: '0.78rem' }}>
                            <option value="FOUR_WEEKS">4주</option><option value="PATCH">6주</option><option value="BIWEEKLY">격주</option><option value="MONTHLY">매월</option>
                        </select>
                        <input type="date" value={newSeasonDueDate} onChange={(e) => setNewSeasonDueDate(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: '#fff', fontSize: '0.78rem' }} />
                        <button onClick={handleAddSeasonTask} style={{ background: '#ff9800', color: '#000', border: 'none', borderRadius: '4px', padding: '0 10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.78rem' }}>추가</button>
                    </div>
                )}

                {seasonTasks.length === 0 && <div style={{ textAlign: 'center', color: '#555', fontSize: '0.8rem', padding: '6px' }}>등록된 콘텐츠가 없습니다.</div>}
                {seasonTasks.map(task => <TaskItem key={task.id} task={task} isDone={doneIds.includes(task.id)} onToggle={() => handleToggle(task.id)} />)}
            </div>
        </div>
    )
}

function TaskItem({ task, isDone, onToggle }) {
    return (
        <div className={`task-item ${isDone ? 'done' : ''}`} onClick={onToggle} style={{ padding: '8px 10px' }}>
            <div className="task-info">
                <div className="task-title" style={{ fontSize: '0.85rem' }}>
                    {task.title}
                    {task.days_remaining !== null && <span className="badge d-day">D-{task.days_remaining}</span>}
                </div>
            </div>
            <div className={`check-btn ${isDone ? 'checked' : ''}`}>✔</div>
        </div>
    )
}

export default Dashboard;
