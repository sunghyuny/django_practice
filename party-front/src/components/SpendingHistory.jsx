import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';

function SpendingHistory() {
    const [spendings, setSpendings] = useState([]);
    const [nextPage, setNextPage] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchSpendings('/scheduler/spendings/');
    }, []);

    const fetchSpendings = async (url) => {
        try {
            const response = await axios.get(url);
            // DRF Pagination 구조: { count: 123, next: '...', previous: '...', results: [...] }
            const newResults = response.data.results;

            // 날짜 역순 정렬 (기존 데이터와 합쳐서 다시 정렬)
            setSpendings(prev => {
                const combined = [...prev, ...newResults];
                // 중복 제거 (혹시 모를 중복 방지)
                const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                return unique.sort((a, b) => new Date(b.purchased_at) - new Date(a.purchased_at));
            });

            // 다음 페이지 URL 저장 (있으면)
            setNextPage(response.data.next);

        } catch (error) {
            console.error("지출 내역 로딩 실패:", error);
        }
    };


    const handleDelete = async (id) => {
        if (!window.confirm("정말 이 지출 내역을 삭제하시겠습니까?")) return;

        try {
            await axios.delete(`/scheduler/spendings/${id}/`);
            alert("삭제되었습니다.");
            setSpendings(spendings.filter(item => item.id !== id));
        } catch (error) {
            console.error("삭제 실패:", error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="container history-container">
            <div className="dashboard-header">
                <h2>💸 지출 내역 관리</h2>
                <button onClick={() => navigate('/dashboard')} className="back-btn">← 대시보드로</button>
            </div>

            <div className="history-list">
                {spendings.length === 0 ? (
                    <p className="empty-msg">아직 등록된 지출 내역이 없습니다.</p>
                ) : (
                    spendings.map(item => (
                        <div key={item.id} className="history-item">
                            <div className="history-info">
                                <span className={`game-badge ${item.game === 2 ? 'nikke' : 'ww'}`}>
                                    {item.game_name || (item.game === 1 ? '명조' : '니케')}
                                </span>
                                <span className="date">{item.purchased_at}</span>
                                <div className="item-name">{item.item_name} ({item.category})</div>
                            </div>
                            <div className="history-action">
                                <span className="amount">{item.amount.toLocaleString()}원</span>
                                <button onClick={() => handleDelete(item.id)} className="delete-btn">삭제</button>
                            </div>
                        </div>
                    ))
                )}

                {nextPage && (
                    <button onClick={() => fetchSpendings(nextPage)} className="load-more-btn" style={{ marginTop: '20px', padding: '10px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        + 더 보기
                    </button>
                )}
            </div>

        </div>
    );
}

export default SpendingHistory;
