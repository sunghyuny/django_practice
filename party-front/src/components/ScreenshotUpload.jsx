import { useState, useEffect } from 'react';
import axios from '../api/axios';

function ScreenshotUpload() {
    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState('');
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await axios.get('/scheduler/tasks/');
            const taskList = Array.isArray(res.data) ? res.data : res.data.results || [];
            setTasks(taskList);
        } catch (e) {
            console.error('숙제 로딩 실패:', e);
        }
    };

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (f) processFile(f);
    };

    const processFile = (f) => {
        setFile(f);
        setResult(null);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(f);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) processFile(f);
    };

    const handleSubmit = async () => {
        if (!file) return alert('스크린샷을 선택해주세요!');
        if (!selectedTask) return alert('숙제를 선택해주세요!');

        setUploading(true);
        const formData = new FormData();
        formData.append('screenshot', file);

        try {
            const res = await axios.post(
                `/scheduler/tasks/${selectedTask}/complete_with_screenshot/`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            setResult({ success: true, message: res.data.message });
            setFile(null);
            setPreview(null);
            setSelectedTask('');
        } catch (e) {
            setResult({ success: false, message: '업로드에 실패했습니다.' });
        }
        setUploading(false);
    };

    return (
        <div className="container dashboard-container">
            <div className="dashboard-header">
                <h2>📸 스크린샷 인증</h2>
            </div>

            <p className="screenshot-desc">게임 스크린샷을 업로드하여 숙제를 완료 처리하세요!</p>

            {/* 드래그앤드롭 영역 */}
            <div
                className={`drop-zone ${dragOver ? 'drag-over' : ''} ${preview ? 'has-preview' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('screenshot-input').click()}
            >
                {preview ? (
                    <img src={preview} alt="미리보기" className="preview-img" />
                ) : (
                    <div className="drop-placeholder">
                        <span className="drop-icon">📁</span>
                        <p>클릭하거나 이미지를 드래그하세요</p>
                    </div>
                )}
                <input
                    id="screenshot-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
            </div>

            {/* 숙제 선택 */}
            <div className="screenshot-form">
                <select
                    value={selectedTask}
                    onChange={e => setSelectedTask(e.target.value)}
                    className="task-select"
                >
                    <option value="">-- 완료할 숙제 선택 --</option>
                    {tasks.map(t => (
                        <option key={t.id} value={t.id}>[{t.game_name}] {t.title}</option>
                    ))}
                </select>

                <button
                    onClick={handleSubmit}
                    disabled={uploading || !file || !selectedTask}
                    className="submit-btn"
                >
                    {uploading ? '업로드 중...' : '✅ 완료 처리'}
                </button>
            </div>

            {/* 결과 메시지 */}
            {result && (
                <div className={`result-message ${result.success ? 'success' : 'error'}`}>
                    {result.message}
                </div>
            )}
        </div>
    );
}

export default ScreenshotUpload;
