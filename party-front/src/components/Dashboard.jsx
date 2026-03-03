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


// DB의 Game ID와 매핑 (명조:1, 니케:2)
const GAME_IDS = {
    '명조': 1,
    '니케': 2
};

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

    // 지출 상태
    const [spending, setSpending] = useState({ total: 0, breakdown: { ww: 0, nikke: 0 }, category_breakdown: {} });
    const [spendingTrend, setSpendingTrend] = useState([]);

    // 입력 폼 상태 (지출)
    const [newAmount, setNewAmount] = useState('');
    const [newCategory, setNewCategory] = useState('MONTHLY');

    // 입력 폼 상태 (숙제/루틴)
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskType, setNewTaskType] = useState('DAILY');

    // 입력 폼 상태 (엔드 콘텐츠)
    const [showSeasonForm, setShowSeasonForm] = useState(false);
    const [newSeasonTitle, setNewSeasonTitle] = useState('');
    const [newSeasonType, setNewSeasonType] = useState('FOUR_WEEKS');
    const [newSeasonDueDate, setNewSeasonDueDate] = useState('');


    useEffect(() => {
        fetchData();
    }, []);


    const fetchData = async () => {
        try {
            const [taskRes, spendSummaryRes, trendRes, statusRes] = await Promise.all([
                axios.get('/scheduler/tasks/'),
                axios.get('/scheduler/spendings/monthly_summary/'),
                axios.get('/scheduler/spendings/spending_trend/'),
                axios.get('/scheduler/tasks/today_status/'),
            ]);

            setTasks(Array.isArray(taskRes.data) ? taskRes.data : taskRes.data.results);
            setSpending(spendSummaryRes.data);
            setSpendingTrend(trendRes.data || []);

            // 서버에서 받은 오늘 완료 상태 적용
            const doneTaskIds = (statusRes.data || [])
                .filter(s => s.is_done)
                .map(s => s.task_id);
            setDoneIds(doneTaskIds);

        } catch (error) {
            console.error("로딩 실패:", error);
        }
    }


    const handleToggle = async (taskId) => {
        if (doneIds.includes(taskId)) {
            setDoneIds(doneIds.filter(id => id !== taskId));
        } else {
            // 낙관적 업데이트: UI 먼저 반영
            setDoneIds([...doneIds, taskId]);
            try {
                await axios.post('/scheduler/logs/', { task: taskId });
            } catch (e) {
                // 실패 시 롤백
                setDoneIds(prev => prev.filter(id => id !== taskId));
                console.error("완료 처리 실패:", e);
            }
        }
    }

    const handleAddSpending = async () => {
        if (!newAmount) return alert("금액을 입력해주세요!");

        const amountNum = parseInt(newAmount);
        const gameId = GAME_IDS[activeTab];
        const selectedCategoryObj = categories.find(cat => cat.code === newCategory);
        const autoItemName = selectedCategoryObj ? selectedCategoryObj.name : '기타';

        // 낙관적 업데이트: UI 즉시 반영
        const key = activeTab === '명조' ? 'ww' : 'nikke';
        setSpending(prev => ({
            ...prev,
            total: prev.total + amountNum,
            breakdown: { ...prev.breakdown, [key]: prev.breakdown[key] + amountNum }
        }));
        setNewAmount('');

        // 백그라운드 API 호출
        try {
            await axios.post('/scheduler/spendings/', {
                item_name: autoItemName,
                amount: amountNum,
                game: gameId,
                purchased_at: new Date().toISOString().split('T')[0],
                category: newCategory
            });
            fetchData(); // 정확한 데이터로 동기화

        } catch (error) {
            console.error("지출 등록 실패:", error);
            // 실패 시 롤백
            setSpending(prev => ({
                ...prev,
                total: prev.total - amountNum,
                breakdown: { ...prev.breakdown, [key]: prev.breakdown[key] - amountNum }
            }));
            alert("오류 발생!");
        }
    }


    const handleAddTask = async () => {
        if (!newTaskTitle) return alert("숙제 이름을 입력해주세요.");
        const gameId = GAME_IDS[activeTab];

        try {
            await axios.post('/scheduler/tasks/', {
                title: newTaskTitle,
                game: gameId,
                reset_type: newTaskType,
                priority: 1
            });
            alert("새로운 루틴이 추가되었습니다!");
            setNewTaskTitle('');
            setShowTaskForm(false);
            fetchData();
        } catch (error) {
            console.error("루틴 추가 실패:", error);
            alert("루틴 추가 중 문제가 발생했습니다.");
        }
    }

    const handleAddSeasonTask = async () => {
        if (!newSeasonTitle) return alert("콘텐츠 이름을 입력해주세요.");
        const gameId = GAME_IDS[activeTab];

        try {
            await axios.post('/scheduler/tasks/', {
                title: newSeasonTitle,
                game: gameId,
                reset_type: newSeasonType,
                due_date: newSeasonDueDate || null,
                priority: 1
            });
            setNewSeasonTitle('');
            setNewSeasonDueDate('');
            setShowSeasonForm(false);
            fetchData();
        } catch (error) {
            console.error("시즌 일정 추가 실패:", error);
            alert("일정 추가 중 문제가 발생했습니다.");
        }
    }

    const filteredTasks = tasks.filter(task => task.game_name === activeTab);

    const seasonTasks = filteredTasks.filter(t => ['FOUR_WEEKS', 'PATCH', 'BIWEEKLY', 'MONTHLY'].includes(t.reset_type));
    const routineTasks = filteredTasks.filter(t => ['DAILY', 'WEEKLY'].includes(t.reset_type));

    const user = JSON.parse(localStorage.getItem('user_info') || '{}');

    // 숙제 달성률 계산
    const totalTasks = filteredTasks.length;
    const doneTasks = filteredTasks.filter(t => doneIds.includes(t.id)).length;
    const donePercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // ★ Feature 1: 게임별 지출 Bar 차트
    const barChartData = {
        labels: ['명조', '니케'],
        datasets: [{
            label: '이번 달 지출',
            data: [spending.breakdown.ww, spending.breakdown.nikke],
            backgroundColor: ['#00e5ff', '#ff3333'],
            borderRadius: 5,
        }],
    };
    const barChartOptions = {
        responsive: true,
        plugins: { legend: { display: false }, title: { display: true, text: '게임별 지출 현황', color: '#888' } },
        scales: { y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#888' } }, x: { grid: { display: false }, ticks: { color: '#888' } } },
    };

    // ★ Feature 1: 숙제 달성률 도넛 차트
    const doughnutData = {
        labels: ['완료', '미완료'],
        datasets: [{
            data: [doneTasks, totalTasks - doneTasks],
            backgroundColor: ['#4caf50', '#333'],
            borderWidth: 0,
            cutout: '75%',
        }],
    };
    const doughnutOptions = {
        responsive: true,
        plugins: { legend: { display: false } },
    };

    // ★ Feature 1: 카테고리별 지출 도넛 차트
    const catBreakdown = spending.category_breakdown || {};
    const catLabels = Object.values(catBreakdown).map(c => c.name);
    const catValues = Object.values(catBreakdown).map(c => c.total);
    const catColors = ['#ff6384', '#36a2eb', '#ffce56', '#9966ff'];

    const categoryDoughnutData = {
        labels: catLabels.length ? catLabels : ['데이터 없음'],
        datasets: [{
            data: catValues.length ? catValues : [1],
            backgroundColor: catValues.length ? catColors : ['#333'],
            borderWidth: 0,
        }],
    };

    // ★ Feature 1: 월별 지출 추이 라인 차트
    const trendLabels = spendingTrend.map(m => m.label);
    const trendValues = spendingTrend.map(m => m.total);
    const lineChartData = {
        labels: trendLabels,
        datasets: [{
            label: '월별 지출',
            data: trendValues,
            borderColor: '#00d2ff',
            backgroundColor: 'rgba(0, 210, 255, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#00d2ff',
        }],
    };
    const lineChartOptions = {
        responsive: true,
        plugins: { legend: { display: false }, title: { display: true, text: '최근 6개월 지출 추이', color: '#888' } },
        scales: { y: { beginAtZero: true, grid: { color: '#222' }, ticks: { color: '#888' } }, x: { grid: { display: false }, ticks: { color: '#888' } } },
    };

    return (
        <div className="container dashboard-container">
            <div className="dashboard-header">
                <h2>📊 Dashboard <span className="user-badge">{user.nickname || '게이머'}님</span></h2>
            </div>

            <div className="tabs">
                <button className={`tab-btn ww ${activeTab === '명조' ? 'active' : ''}`} onClick={() => setActiveTab('명조')}>🌊 명조</button>
                <button className={`tab-btn nikke ${activeTab === '니케' ? 'active' : ''}`} onClick={() => setActiveTab('니케')}>🍑 니케</button>
            </div>

            <div className="spending-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div className="money-detail">이번 달 {activeTab} 지출</div>
                    <button onClick={() => navigate('/history')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>
                        내역 관리 &gt;
                    </button>
                </div>
                <div className="money-total">
                    {activeTab === '명조'
                        ? spending.breakdown.ww.toLocaleString()
                        : spending.breakdown.nikke.toLocaleString()}원
                </div>

                <div className="spending-form">
                    <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="category-select" style={{ flex: 1 }}>
                        {categories.map((cat) => <option key={cat.code} value={cat.code}>{cat.name}</option>)}
                    </select>
                    <input type="number" placeholder="금액" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} style={{ width: '100px' }} />
                    <button onClick={handleAddSpending}>등록</button>
                </div>
            </div>

            {/* ★ 차트 그리드 */}
            <div className="chart-grid">
                <div className="chart-card">
                    <Bar options={barChartOptions} data={barChartData} />
                </div>
                <div className="chart-card doughnut-card">
                    <div className="doughnut-label">숙제 달성률</div>
                    <div className="doughnut-wrapper">
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                        <div className="doughnut-center">{donePercent}%</div>
                    </div>
                </div>
            </div>

            <div className="chart-grid">
                <div className="chart-card">
                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', textAlign: 'center' }}>카테고리별 지출</div>
                    <Doughnut data={categoryDoughnutData} options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#888', font: { size: 11 } } } } }} />
                </div>
                <div className="chart-card">
                    <Line options={lineChartOptions} data={lineChartData} />
                </div>
            </div>


            <div className="task-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div className="section-title" style={{ margin: 0, border: 'none' }}>🔥 엔드 콘텐츠 (Season)</div>
                    <button onClick={() => setShowSeasonForm(!showSeasonForm)} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>
                        {showSeasonForm ? '닫기' : '+ 일정 추가'}
                    </button>
                </div>

                {showSeasonForm && (
                    <div className="routine-form" style={{ marginBottom: '15px', background: '#222', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                placeholder="콘텐츠 이름 (예: 심연 콘텐츠)"
                                value={newSeasonTitle}
                                onChange={(e) => setNewSeasonTitle(e.target.value)}
                                style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: '#fff' }}
                            />
                            <select
                                value={newSeasonType}
                                onChange={(e) => setNewSeasonType(e.target.value)}
                                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: '#fff' }}
                            >
                                <option value="FOUR_WEEKS">4주 (시즌)</option>
                                <option value="PATCH">패치 (6주)</option>
                                <option value="BIWEEKLY">격주 (2주)</option>
                                <option value="MONTHLY">매월</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="date"
                                value={newSeasonDueDate}
                                onChange={(e) => setNewSeasonDueDate(e.target.value)}
                                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: '#fff' }}
                                placeholder="마감일"
                            />
                            <button onClick={handleAddSeasonTask} style={{ background: '#ff9800', color: '#000', border: 'none', borderRadius: '4px', padding: '0 15px', fontWeight: 'bold', cursor: 'pointer' }}>
                                추가
                            </button>
                        </div>
                    </div>
                )}

                {seasonTasks.length === 0 && <div className="empty-msg">등록된 시즌 콘텐츠가 없습니다.</div>}
                {seasonTasks.map(task => <TaskItem key={task.id} task={task} isDone={doneIds.includes(task.id)} onToggle={() => handleToggle(task.id)} />)}
            </div>

            <div className="task-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div className="section-title" style={{ margin: 0, border: 'none' }}>📅 루틴 (Daily / Weekly)</div>
                    <button onClick={() => setShowTaskForm(!showTaskForm)} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>
                        {showTaskForm ? '닫기' : '+ 루틴 추가'}
                    </button>
                </div>

                {showTaskForm && (
                    <div className="routine-form" style={{ marginBottom: '15px', background: '#222', padding: '10px', borderRadius: '8px', display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            placeholder="할 일 이름 (예: 일일 의뢰)"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: '#fff' }}
                        />
                        <select
                            value={newTaskType}
                            onChange={(e) => setNewTaskType(e.target.value)}
                            style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: '#fff' }}
                        >
                            <option value="DAILY">매일 (Daily)</option>
                            <option value="WEEKLY">주간 (Weekly)</option>
                        </select>
                        <button onClick={handleAddTask} style={{ background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 15px', fontWeight: 'bold', cursor: 'pointer' }}>
                            추가
                        </button>
                    </div>
                )}

                {routineTasks.length === 0 && <div className="empty-msg">등록된 루틴이 없습니다.</div>}
                {routineTasks.map(task => <TaskItem key={task.id} task={task} isDone={doneIds.includes(task.id)} onToggle={() => handleToggle(task.id)} />)}
            </div>

        </div >
    )
}

function TaskItem({ task, isDone, onToggle }) {
    return (
        <div className={`task-item ${isDone ? 'done' : ''}`} onClick={onToggle}>
            <div className="task-info">
                <div className="task-title">
                    {task.title}
                    {task.days_remaining !== null && <span className="badge d-day">D-{task.days_remaining}</span>}
                    {task.reset_type === 'WEEKLY' && <span className="badge weekly">주간</span>}
                </div>
                <div className="task-reward">{task.reward}</div>
            </div>
            <div className={`check-btn ${isDone ? 'checked' : ''}`}>✔</div>
        </div>
    )
}

export default Dashboard;
