import { useState, useEffect } from 'react'
import axios from '../api/axios'
import { useNavigate } from 'react-router-dom'; // 네비게이션 추가
import { Bar } from 'react-chartjs-2';

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);


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

    // 지출 상태
    const [spending, setSpending] = useState(() => {
        const saved = localStorage.getItem('mySpendingData');
        return saved ? JSON.parse(saved) : { total: 0, breakdown: { ww: 0, nikke: 0 } };
    });
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
    const [activeTab, setActiveTab] = useState('명조')

    // 입력 폼 상태 (지출)
    const [newAmount, setNewAmount] = useState('');
    const [newCategory, setNewCategory] = useState('MONTHLY');

    // 입력 폼 상태 (숙제/루틴)
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskType, setNewTaskType] = useState('DAILY');


    // 초기 데이터 로드
    // 1. 초기 데이터 로드 (컴포넌트 마운트 시 1회만)
    useEffect(() => {
        fetchData();
    }, []);

    // 2. Spending 상태 변경 시 로컬 스토리지 저장 (데이터 페칭과 분리)
    useEffect(() => {
        localStorage.setItem('mySpendingData', JSON.stringify(spending));
    }, [spending]);


    const fetchData = async () => {
        try {
            const [taskRes, spendSummaryRes] = await Promise.all([
                axios.get('/scheduler/tasks/'),
                axios.get('/scheduler/spendings/monthly_summary/')
            ]);

            setTasks(Array.isArray(taskRes.data) ? taskRes.data : taskRes.data.results);
            setSpending(spendSummaryRes.data);


        } catch (error) {
            console.error("로딩 실패:", error);
        }
    }


    const handleToggle = async (taskId) => {
        // ... 기존 로직 (API 호출 경로 수정 필요)
        if (doneIds.includes(taskId)) {
            setDoneIds(doneIds.filter(id => id !== taskId));
        } else {
            setDoneIds([...doneIds, taskId]);
        }
        // API 호출 생략 (TaskLog 구현 필요)
    }

    const handleAddSpending = async () => {
        if (!newAmount) return alert("금액을 입력해주세요!");

        const amountNum = parseInt(newAmount);
        const gameId = GAME_IDS[activeTab];
        const selectedCategoryObj = categories.find(cat => cat.code === newCategory);
        const autoItemName = selectedCategoryObj ? selectedCategoryObj.name : '기타';

        try {
            await axios.post('/scheduler/spendings/', {
                item_name: autoItemName,
                amount: amountNum,
                game: gameId,
                purchased_at: new Date().toISOString().split('T')[0],
                category: newCategory
            });
            // 성공 시 데이터 재로딩 또는 상태 업데이트
            alert("지출이 등록되었습니다.");
            fetchData(); // 재로딩

        } catch (error) {
            console.error("지출 등록 실패:", error);
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
                // user 필드는 백엔드에서 자동 처리
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

    const filteredTasks = tasks.filter(task => task.game_name === activeTab); // game_name은 serializer에서 옴

    const seasonTasks = filteredTasks.filter(t => ['FOUR_WEEKS', 'PATCH', 'BIWEEKLY', 'MONTHLY'].includes(t.reset_type));
    const routineTasks = filteredTasks.filter(t => ['DAILY', 'WEEKLY'].includes(t.reset_type));

    // 유저 정보 가져오기
    const user = JSON.parse(localStorage.getItem('user_info') || '{}');

    // 차트 데이터 구성
    const chartData = {
        labels: ['명조', '니케'],
        datasets: [
            {
                label: '이번 달 지출',
                data: [spending.breakdown.ww, spending.breakdown.nikke],
                backgroundColor: ['#00e5ff', '#ff3333'],
                borderRadius: 5,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: true, text: '게임별 지출 현황', color: '#888' },
        },
        scales: {
            y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#888' } },
            x: { grid: { display: false }, ticks: { color: '#888' } },
        },
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

            {/* 차트 영역 (가계부 카드 아래) */}
            <div className="chart-card">
                <Bar options={chartOptions} data={chartData} />
            </div>


            <div className="task-section">
                <div className="section-title">🔥 엔드 콘텐츠 (Season)</div>
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
