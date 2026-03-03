import { useState, useEffect } from 'react';
import axios from '../api/axios';

const GAME_IDS = { '명조': 1, '니케': 2 };

function Calendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [logs, setLogs] = useState([]);
    const [spendings, setSpendings] = useState([]);
    const [selectedDay, setSelectedDay] = useState(null);

    // 일정 등록 폼
    const [showEventForm, setShowEventForm] = useState(false);
    const [eventTitle, setEventTitle] = useState('');
    const [eventGame, setEventGame] = useState('명조');
    const [eventType, setEventType] = useState('FOUR_WEEKS');

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    useEffect(() => {
        fetchMonthData();
    }, [year, month]);

    const fetchMonthData = async () => {
        try {
            const [logRes, spendRes] = await Promise.all([
                axios.get('/scheduler/logs/'),
                axios.get('/scheduler/spendings/'),
            ]);
            setLogs(Array.isArray(logRes.data) ? logRes.data : logRes.data.results || []);
            setSpendings(Array.isArray(spendRes.data) ? spendRes.data : spendRes.data.results || []);
        } catch (e) {
            console.error('캘린더 데이터 로딩 실패:', e);
        }
    };

    // 달력 생성
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks = [];
    let days = [];

    // 빈 칸 (이전 달)
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        days.push(d);
        if (days.length === 7) {
            weeks.push(days);
            days = [];
        }
    }
    if (days.length > 0) {
        while (days.length < 7) days.push(null);
        weeks.push(days);
    }

    const getDateStr = (day) => {
        if (!day) return '';
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const getDayData = (day) => {
        if (!day) return { taskCount: 0, spendTotal: 0 };
        const dateStr = getDateStr(day);

        const dayLogs = logs.filter(l => l.completed_at?.startsWith(dateStr));
        const daySpendings = spendings.filter(s => s.purchased_at === dateStr);
        const spendTotal = daySpendings.reduce((sum, s) => sum + (s.amount || 0), 0);

        return {
            taskCount: dayLogs.length,
            spendTotal,
            logs: dayLogs,
            spendings: daySpendings,
        };
    };

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const handleAddEvent = async () => {
        if (!eventTitle) return alert('일정 이름을 입력해주세요!');
        if (!selectedDay) return alert('날짜를 먼저 선택해주세요!');

        const dateStr = getDateStr(selectedDay);
        const gameId = GAME_IDS[eventGame];

        try {
            await axios.post('/scheduler/tasks/', {
                title: eventTitle,
                game: gameId,
                reset_type: eventType,
                due_date: dateStr,
                priority: 1,
            });
            setEventTitle('');
            setShowEventForm(false);
            fetchMonthData();
        } catch (e) {
            console.error('일정 추가 실패:', e);
            alert('일정 추가 중 문제가 발생했습니다.');
        }
    };

    const handleExportSpending = async () => {
        try {
            const res = await axios.get('/scheduler/spendings/export_csv/', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'spendings.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert('CSV 다운로드 실패');
        }
    };

    const handleExportLogs = async () => {
        try {
            const res = await axios.get('/scheduler/logs/export_csv/', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'task_logs.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert('CSV 다운로드 실패');
        }
    };

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    const selectedData = selectedDay ? getDayData(selectedDay) : null;

    return (
        <div className="container dashboard-container">
            <div className="dashboard-header">
                <h2>📅 캘린더</h2>
            </div>

            {/* 월 네비게이션 */}
            <div className="calendar-nav">
                <button onClick={prevMonth} className="cal-nav-btn">◀</button>
                <span className="cal-month-title">{year}년 {monthNames[month]}</span>
                <button onClick={nextMonth} className="cal-nav-btn">▶</button>
            </div>

            {/* 요일 헤더 */}
            <div className="calendar-grid">
                {dayNames.map(d => (
                    <div key={d} className="cal-day-header">{d}</div>
                ))}

                {/* 날짜 셀 */}
                {weeks.flat().map((day, idx) => {
                    const data = getDayData(day);
                    const isToday = day && getDateStr(day) === new Date().toISOString().split('T')[0];
                    return (
                        <div
                            key={idx}
                            className={`cal-cell ${day ? 'has-day' : ''} ${isToday ? 'today' : ''} ${selectedDay === day ? 'selected' : ''}`}
                            onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                        >
                            {day && (
                                <>
                                    <span className="cal-date">{day}</span>
                                    <div className="cal-indicators">
                                        {data.taskCount > 0 && <span className="cal-dot task-dot" title={`숙제 ${data.taskCount}개 완료`}>✔</span>}
                                        {data.spendTotal > 0 && <span className="cal-dot spend-dot" title={`${data.spendTotal.toLocaleString()}원`}>💸</span>}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 선택된 날짜 상세 */}
            {selectedData && (
                <div className="cal-detail-panel">
                    <h3>{month + 1}월 {selectedDay}일 상세</h3>
                    {selectedData.logs?.length > 0 && (
                        <div className="cal-detail-section">
                            <h4>✅ 완료한 숙제</h4>
                            {selectedData.logs.map((l, i) => (
                                <div key={i} className="cal-detail-item">
                                    <span>{l.task_title || `Task #${l.task}`}</span>
                                    <span className="cal-detail-time">{l.completed_at?.split('T')[1]?.substring(0, 5)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {selectedData.spendings?.length > 0 && (
                        <div className="cal-detail-section">
                            <h4>💰 지출 내역</h4>
                            {selectedData.spendings.map((s, i) => (
                                <div key={i} className="cal-detail-item">
                                    <span>[{s.game_name}] {s.item_name}</span>
                                    <span className="cal-detail-amount">{s.amount?.toLocaleString()}원</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {(!selectedData.logs?.length && !selectedData.spendings?.length) && (
                        <div className="empty-msg">이 날은 기록이 없습니다.</div>
                    )}

                    {/* 일정 등록 버튼 */}
                    <button
                        onClick={() => setShowEventForm(!showEventForm)}
                        className="add-goal-btn"
                        style={{ marginTop: '12px' }}
                    >
                        {showEventForm ? '닫기' : '+ 이 날짜에 일정 추가'}
                    </button>

                    {showEventForm && (
                        <div className="goal-form" style={{ marginTop: '10px' }}>
                            <input
                                type="text"
                                placeholder="일정 이름 (예: 심연 마감, 시즌 콘텐츠)"
                                value={eventTitle}
                                onChange={e => setEventTitle(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select
                                    value={eventGame}
                                    onChange={e => setEventGame(e.target.value)}
                                    style={{ flex: 1, background: '#2a2a2a', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '6px' }}
                                >
                                    <option value="명조">🌊 명조</option>
                                    <option value="니케">🍑 니케</option>
                                </select>
                                <select
                                    value={eventType}
                                    onChange={e => setEventType(e.target.value)}
                                    style={{ flex: 1, background: '#2a2a2a', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '6px' }}
                                >
                                    <option value="FOUR_WEEKS">4주 (시즌)</option>
                                    <option value="PATCH">패치 (6주)</option>
                                    <option value="BIWEEKLY">격주 (2주)</option>
                                    <option value="MONTHLY">매월</option>
                                    <option value="DAILY">매일</option>
                                    <option value="WEEKLY">주간</option>
                                </select>
                            </div>
                            <button onClick={handleAddEvent} className="submit-btn">일정 등록</button>
                        </div>
                    )}
                </div>
            )}

            {/* CSV 다운로드 버튼 */}
            <div className="export-section">
                <div className="section-title">📥 데이터 내보내기</div>
                <div className="export-buttons">
                    <button onClick={handleExportSpending} className="export-btn">💰 지출 CSV 다운로드</button>
                    <button onClick={handleExportLogs} className="export-btn">✅ 숙제 CSV 다운로드</button>
                </div>
            </div>
        </div>
    );
}

export default Calendar;
