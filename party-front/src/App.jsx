// src/App.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const API_BASE_URL = "http://127.0.0.1:8000"

// DB의 Game ID와 매핑 (명조:1, 니케:2)
const GAME_IDS = {
  '명조': 1,
  '니케': 2
};

// ★ [최적화 1] 카테고리 기본값 미리 정의 (서버 응답 기다릴 필요 없이 바로 렌더링)
const DEFAULT_CATEGORIES = [
  { code: 'MONTHLY', name: '월정액' },
  { code: 'BP', name: '패스 (Battle Pass)' },
  { code: 'PACK', name: '패키지/트럭' },
  { code: 'SKIN', name: '스킨/코스튬' },
];
function App() {
  const [tasks, setTasks] = useState([])
  const [doneIds, setDoneIds] = useState([])
  
  // 지출 상태
  const [spending, setSpending] = useState(() => {
    const saved = localStorage.getItem('mySpendingData');
    return saved ? JSON.parse(saved) : { total: 0, breakdown: { ww: 0, nikke: 0 } };
  });
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)

  const [activeTab, setActiveTab] = useState('명조')

  // 입력 폼 상태
  const [newItemName, setNewItemName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('MONTHLY'); // ★ 기본값 설정

  // 1. 초기 데이터 로드
  useEffect(() => {
    localStorage.setItem('mySpendingData', JSON.stringify(spending));
    fetchData();
  }, [spending])

  const fetchData = async () => {
    try {
// ★ [최적화 2] Promise.all로 두 요청을 "동시에" 출발시킴
      // 기존: dashboard 갔다옴 -> spending 갔다옴 (시간 2배)
      // 변경: dashboard, spending 동시 출발 (시간 절반)
      const [taskRes, spendRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/scheduler/api/dashboard/`),
        axios.get(`${API_BASE_URL}/scheduler/api/spending/`)
      ]);

      // 1. 숙제 데이터 세팅
      setTasks(taskRes.data.tasks);
      setDoneIds(taskRes.data.done_ids);

      // 2. 가계부 데이터 세팅
      setSpending(spendRes.data.summary);
      
      // 3. 서버에 최신 카테고리가 있다면 덮어쓰기 (없으면 기본값 유지)
      if (spendRes.data.categories && spendRes.data.categories.length > 0) {
        setCategories(spendRes.data.categories);
      }
    } catch (error) {
      console.error("로딩 실패:", error);
    }
  }

  // 2. 숙제 체크/해제
  const handleToggle = async (taskId) => {
    // UI 먼저 업데이트 (낙관적)
    if (doneIds.includes(taskId)) {
      setDoneIds(doneIds.filter(id => id !== taskId));
    } else {
      setDoneIds([...doneIds, taskId]);
    }

    try {
      await axios.post(`${API_BASE_URL}/scheduler/api/toggle/${taskId}/`);
    } catch (error) {
      console.error("토글 실패", error);
      fetchData(); // 실패 시 롤백 겸 재로딩
    }
  }
const handleAddSpending = async () => {
    if (!newAmount) return alert("금액을 입력해주세요!"); // 이름 입력 체크 제거

    const amountNum = parseInt(newAmount);
    const gameId = GAME_IDS[activeTab];
    
    // ★ [핵심] 선택된 카테고리 코드(MONTHLY)로 이름(월정액) 찾기
    const selectedCategoryObj = categories.find(cat => cat.code === newCategory);
    const autoItemName = selectedCategoryObj ? selectedCategoryObj.name : '기타';

    // 낙관적 업데이트 (화면 먼저 갱신)
    setSpending(prev => {
      const targetKey = activeTab === '명조' ? 'ww' : 'nikke';
      return {
        ...prev,
        total: prev.total + amountNum,
        breakdown: {
          ...prev.breakdown,
          [targetKey]: prev.breakdown[targetKey] + amountNum
        }
      };
    });

    // 입력창 초기화 (금액만 지우면 됨)
    setNewAmount('');

    try {
      await axios.post(`${API_BASE_URL}/scheduler/api/spending/`, {
        item_name: autoItemName, // ★ 찾은 카테고리 이름을 상품명으로 전송
        amount: amountNum,
        game: gameId,       
        purchased_at: new Date().toISOString().split('T')[0],
        category: newCategory
      });
      
    } catch (error) {
      console.error("지출 등록 실패:", error);
      alert("오류 발생! 새로고침합니다.");
      fetchData();
    }
}

  // 필터링 로직
  const filteredTasks = tasks.filter(task => task.game_name === activeTab);
  
  const seasonTasks = filteredTasks.filter(t => 
    ['FOUR_WEEKS', 'PATCH', 'BIWEEKLY', 'MONTHLY'].includes(t.reset_type)
  );
  const routineTasks = filteredTasks.filter(t => 
    ['DAILY', 'WEEKLY'].includes(t.reset_type)
  );

  return (
    <div className="container">
      {/* 탭 버튼 */}
      <div className="tabs">
        <button 
          className={`tab-btn ww ${activeTab === '명조' ? 'active' : ''}`} 
          onClick={() => setActiveTab('명조')}>🌊 명조</button>
        <button 
          className={`tab-btn nikke ${activeTab === '니케' ? 'active' : ''}`} 
          onClick={() => setActiveTab('니케')}>🍑 니케</button>
      </div>

      {/* 가계부 카드 */}
      <div className="spending-card">
        <div className="money-detail">이번 달 {activeTab} 지출</div>
        
        {/* 현재 탭에 따라 금액 보여주기 */}
        <div className="money-total">
          {activeTab === '명조' 
            ? spending.breakdown.ww.toLocaleString() 
            : spending.breakdown.nikke.toLocaleString()}원
        </div>

        {/* [NEW] 지출 입력 폼 */}
        <div className="spending-form">
          {/* 1. 카테고리 선택 (서버에서 받아온 목록) */}
          <select 
            value={newCategory} 
            onChange={(e) => setNewCategory(e.target.value)}
            className="category-select"
            style={{ flex: 1 }} // 비율 조정 (선택창을 좀 넓게)
          >
            {categories.map((cat) => (
              <option key={cat.code} value={cat.code}>
                {cat.name}
              </option>
            ))}
          </select>
          {/* 3. 금액 입력 */}
          <input 
            type="number" 
            placeholder="금액" 
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            style={{ width: '100px' }} // 금액창 크기 조절
          />
          <button onClick={handleAddSpending}>등록</button>
        </div>
      </div>

      {/* 숙제 리스트들 (기존 동일) */}
      <div className="task-section">
        <div className="section-title">🔥 엔드 콘텐츠 (Season)</div>
        {seasonTasks.length > 0 ? (
          seasonTasks.map(task => (
            <TaskItem 
              key={task.id} task={task} 
              isDone={doneIds.includes(task.id)} 
              onToggle={() => handleToggle(task.id)} 
            />
          ))
        ) : (
          <div className="empty-msg">현재 진행 중인 시즌 콘텐츠가 없습니다.</div>
        )}
      </div>

      <div className="task-section">
        <div className="section-title">📅 루틴 (Daily / Weekly)</div>
        {routineTasks.map(task => (
          <TaskItem 
            key={task.id} task={task} 
            isDone={doneIds.includes(task.id)} 
            onToggle={() => handleToggle(task.id)} 
          />
        ))}
      </div>
    </div>
  )
}

// 개별 아이템 컴포넌트
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

export default App