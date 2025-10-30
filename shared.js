/* === TỆP: shared.js === */
/* Đây là bộ não điều phối chung */

// --- GLOBAL STATE ---
// State chung chỉ quản lý phiên và ID
let globalState = {
    currentSessionId: null,
    sessions: {}
};

// --- CONSTANTS (Chung) ---
// Dùng cho việc khởi tạo session
const SYS1_CHOT_SOURCES = ['follow', 'against', '90-100', '80-90', '70-80', '60-70', '50-60'];
const SYS1_CONFIDENCE_RANGES = [
    { key: '50-60', min: 50, max: 60 }, { key: '60-70', min: 60, max: 70 },
    { key: '70-80', min: 70, max: 80 }, { key: '80-90', min: 80, max: 90 },
    { key: '90-100', min: 90, max: 100.1 }
];

// --- INITIALIZATION ---
function initializeApp() {
    globalState.sessions = getSessions();

    // Đảm bảo cấu trúc dữ liệu 3 hệ thống tồn tại trong tất cả các phiên
    Object.values(globalState.sessions).forEach(s => {
        if (!s.sys1) s.sys1 = System1.getInitialState();
        if (!s.sys2) s.sys2 = System2.getInitialState();
        if (!s.sys3) s.sys3 = System3.getInitialState();
        
        // Nâng cấp phiên cũ (nếu thiếu các trường mới của HT1)
        if (s.sys1 && !s.sys1.chotLengthPerformance) {
            s.sys1.chotLengthPerformance = SYS1_CHOT_SOURCES.reduce((acc, key) => { acc[key] = {}; return acc; }, {});
            s.sys1.chotOptimalLengths = SYS1_CHOT_SOURCES.reduce((acc, key) => { acc[key] = null; return acc; }, {});
        }
    });

    const lastActiveId = localStorage.getItem('baccaratPatternSessions_v11_sim');
    if (Object.keys(globalState.sessions).length === 0) {
        createNewSession();
    } else {
        const sortedKeys = Object.keys(globalState.sessions).sort((a, b) => parseInt(a.split('-')[1] || 0) - parseInt(b.split('-')[1] || 0));
        const idToLoad = (lastActiveId && globalState.sessions[lastActiveId]) ? lastActiveId : sortedKeys[sortedKeys.length - 1];
        loadSession(idToLoad); // Gán globalState.currentSessionId và updateAllUI
    }

    // Thu gọn Quản lý phiên khi bắt đầu
    const sessionContent = document.getElementById('sessionManagementContent');
    sessionContent.style.maxHeight = '0px';
    document.getElementById('toggleSessionIcon').style.transform = 'rotate(-180deg)';
}

function loadSession(sessionId) {
    if (globalState.sessions[sessionId]) {
        globalState.currentSessionId = sessionId;
        localStorage.setItem('lastActiveSession_v11_sim', globalState.currentSessionId);
        
        // Reset trạng thái tính toán tạm thời của các hệ thống
        System1.resetTempState();
        System2.resetTempState();
        System3.resetTempState();
        
        updateSessionSelector();
        updateAllUI();
    }
}

// --- SESSION MGMT ---
function getSessions() {
    try {
        return JSON.parse(localStorage.getItem('baccaratPatternSessions_v11_sim')) || {};
    } catch (e) {
        return {};
    }
}

function saveSessions() {
    localStorage.setItem('baccaratPatternSessions_v11_sim', JSON.stringify(globalState.sessions));
    localStorage.setItem('lastActiveSession_v11_sim', globalState.currentSessionId);
}

function createNewSession() {
    const newId = `session-${Date.now()}`;
    globalState.currentSessionId = newId;
    
    // Cấu trúc phiên mới chứa dữ liệu cho cả 3 hệ thống
    globalState.sessions[newId] = {
        name: `Phiên ${new Date().toLocaleString('vi-VN')}`,
        history: [], // Lịch sử P/B chung
        sys1: System1.getInitialState(), // Lấy trạng thái khởi tạo từ system1.js
        sys2: System2.getInitialState(), // Lấy trạng thái khởi tạo từ system2.js
        sys3: System3.getInitialState()  // Lấy trạng thái khởi tạo từ system3.js
    };
    
    saveSessions();
    updateSessionSelector();
    updateAllUI();
}

function renameSession() {
    if (!globalState.currentSessionId) return;
    const currentName = globalState.sessions[globalState.currentSessionId].name;
    showCustomPrompt("Nhập tên mới cho phiên:", currentName, (newName) => {
        if (newName && newName.trim() !== "") {
            globalState.sessions[globalState.currentSessionId].name = newName.trim();
            saveSessions();
            updateSessionSelector();
        }
    });
}

function deleteSelectedSessions() {
    const selector = document.getElementById('sessionSelector');
    const selectedIds = Array.from(selector.selectedOptions).map(opt => opt.value);
    if (selectedIds.length === 0) {
        showToast('Vui lòng chọn ít nhất một phiên để xóa.', 'warning');
        return;
    }
    if (selectedIds.length === Object.keys(globalState.sessions).length && Object.keys(globalState.sessions).length > 0) {
        showToast('Không thể xóa tất cả các phiên. Hãy dùng nút "Xóa Tất Cả".', 'error');
        return;
    }
    showCustomConfirm(`Bạn có chắc muốn xóa ${selectedIds.length} phiên đã chọn không?`, () => {
        let wasCurrentSessionDeleted = false;
        selectedIds.forEach(id => {
            if (id === globalState.currentSessionId) {
                wasCurrentSessionDeleted = true;
            }
            delete globalState.sessions[id];
        });
        if (wasCurrentSessionDeleted) {
            globalState.currentSessionId = null;
            localStorage.removeItem('lastActiveSession_v11_sim');
        }
        saveSessions();
        initializeApp(); // Tải lại
        showToast(`Đã xóa ${selectedIds.length} phiên.`, 'success');
    });
}

function deleteAllSessions() {
    showCustomConfirm('BẠN CÓ CHẮC MUỐN XÓA TẤT CẢ CÁC PHIÊN KHÔNG? Hành động này không thể hoàn tác.', () => {
        globalState.sessions = {};
        globalState.currentSessionId = null;
        localStorage.removeItem('baccaratPatternSessions_v11_sim');
        localStorage.removeItem('lastActiveSession_v11_sim');
        initializeApp(); // Tải lại (sẽ tự tạo phiên mới)
        showToast('Tất cả các phiên đã được xóa.', 'success');
    });
}

// --- DATA I/O ---
function exportData() {
    if (!globalState.sessions || Object.keys(globalState.sessions).length === 0) {
        showToast('Không có dữ liệu để xuất.', 'warning');
        return;
    }
    
    // Chỉ xuất 'name' và 'history' chung
    const sessionsToExport = {};
    for (const sessionId in globalState.sessions) {
        sessionsToExport[sessionId] = {
            name: globalState.sessions[sessionId].name,
            history: globalState.sessions[sessionId].history
        };
    }
    
    const dataToExport = JSON.stringify(sessionsToExport, null, 2);
    const blob = new Blob([dataToExport], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    a.download = `LỊCH SỬ NGÀY ${day} THÁNG ${month} NĂM ${year}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Lịch sử các phiên đã được xuất (chỉ gồm history)!', 'success');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedSessions = JSON.parse(e.target.result);
            if (typeof importedSessions !== 'object' || importedSessions === null) throw new Error("Invalid format: Not an object");
            
            let dataOk = true;
            for (const key in importedSessions) {
                const s = importedSessions[key];
                if (!s.name || !Array.isArray(s.history)) {
                    dataOk = false; break;
                };
            }
            if (!dataOk && Object.keys(importedSessions).length > 0) throw new Error("Invalid session data: name or history format incorrect.");

            showCustomConfirm('Dữ liệu hiện tại sẽ bị ghi đè. Quá trình này sẽ TÍNH TOÁN LẠI tất cả dự đoán cho cả 3 hệ thống. Bạn có chắc muốn tiếp tục?', () => {
                showLoadingModal('Đang nhập lịch sử và tính toán lại...');
                setTimeout(() => {
                    try {
                        runRecalculation(importedSessions); // Đổi tên từ runSimulation
                        hideLoadingModal();
                        showToast('Nhập lịch sử và tính toán lại thành công!', 'success');
                    } catch (simError) {
                        hideLoadingModal();
                        showToast('Lỗi trong quá trình tính toán lại dữ liệu.', 'error');
                        console.error("Calculation error during import:", simError);
                        initializeApp();
                    }
                }, 100);
            });
        } catch (error) {
            hideLoadingModal();
            showToast(`Lỗi: File dữ liệu không hợp lệ. (${error.message})`, 'error');
            console.error("Import error:", error);
        } finally {
            event.target.value = '';
        }
    };
    reader.onerror = function() {
        hideLoadingModal();
        showToast('Lỗi đọc file.', 'error');
        event.target.value = '';
    };
    reader.readAsText(file);
}

/**
 * Tái tính toán toàn bộ state từ file 'history'.
 */
function runRecalculation(importedSessions) {
    globalState.sessions = {}; // Xóa state hiện tại
    globalState.currentSessionId = null;
    localStorage.removeItem('baccaratPatternSessions_v11_sim');
    localStorage.removeItem('lastActiveSession_v11_sim');

    const sortedSessionIds = Object.keys(importedSessions).sort((a, b) => {
        const timeA = parseInt(a.split('-')[1] || 0);
        const timeB = parseInt(b.split('-')[1] || 0);
        return timeA - timeB;
    });

    const allSessionsHistory = []; // Dùng để làm context lịch sử

    sortedSessionIds.forEach((sessionId) => {
        const importedSession = importedSessions[sessionId];
        if (!importedSession || !importedSession.name || !Array.isArray(importedSession.history)) {
            return;
        }

        const newId = sessionId;
        // Tạo phiên mới, trống rỗng
        const newSession = {
            name: importedSession.name,
            history: [],
            sys1: System1.getInitialState(),
            sys2: System2.getInitialState(),
            sys3: System3.getInitialState()
        };
        globalState.sessions[newId] = newSession;
        globalState.currentSessionId = newId;

        // Xử lý lại từng kết quả
        importedSession.history.forEach((result) => {
            if (result === 'P' || result === 'B') {
                // Lấy context là *tất cả các phiên đã xử lý trước đó*
                const historicalContext = [...allSessionsHistory, newSession];
                
                // 1. Tính toán dự đoán (cho ván NÀY)
                System1.runAllCalculations(newSession, historicalContext);
                System2.runAllCalculations(newSession, historicalContext);
                System3.runAllCalculations(newSession, historicalContext);
                
                // 2. Ghi log kết quả (của ván NÀY)
                System1.commitResult(newSession, result, historicalContext);
                System2.commitResult(newSession, result, historicalContext);
                System3.commitResult(newSession, result, historicalContext);
                
                // 3. Thêm vào lịch sử chung
                newSession.history.push(result);
            }
        });
        
        // Lưu phiên đã xử lý xong vào context chung
        allSessionsHistory.push(newSession);
        saveSessions(); // Lưu sau mỗi phiên
    });

    // Tải phiên cuối cùng
    if (Object.keys(globalState.sessions).length > 0) {
        const lastProcessedId = sortedSessionIds[sortedSessionIds.length - 1];
        if (globalState.sessions[lastProcessedId]) {
            loadSession(lastProcessedId);
        } else {
            createNewSession();
        }
    } else {
        createNewSession();
    }
    
    // Cập nhật UI lần cuối
    updateSessionSelector();
    updateAllUI();
}


// --- COORDINATORS (Hàm điều phối) ---

/**
 * Hàm điều phối chính khi nhấn nút P hoặc B.
 */
function addResult(result) {
    if (!globalState.currentSessionId) return;
    
    const session = globalState.sessions[globalState.currentSessionId];
    const allSessions = Object.values(globalState.sessions);

    // 1. Yêu cầu cả 3 hệ thống TÍNH TOÁN dự đoán cho ván HIỆN TẠI
    // (Dựa trên lịch sử 0 -> N-1)
    System1.runAllCalculations(session, allSessions);
    System2.runAllCalculations(session, allSessions);
    System3.runAllCalculations(session, allSessions);

    // 2. Yêu cầu cả 3 hệ thống GHI LOG kết quả
    // (So sánh dự đoán đã tính ở bước 1 với 'result' và lưu vào mảng)
    System1.commitResult(session, result, allSessions);
    System2.commitResult(session, result, allSessions);
    System3.commitResult(session, result, allSessions);

    // 3. Cập nhật lịch sử chung
    session.history.push(result);

    // 4. Lưu và Cập nhật UI
    saveSessions();
    updateAllUI();
}

/**
 * Hàm điều phối chính khi Hoàn tác.
 */
function undoLast() {
    if (!globalState.currentSessionId) return;
    const session = globalState.sessions[globalState.currentSessionId];
    if (session.history.length === 0) return;

    const lastResult = session.history[session.history.length - 1];
    
    // 1. Yêu cầu cả 3 hệ thống hoàn tác
    // (Chúng sẽ tự xóa log, tính toán lại performance...)
    System1.undoLast(session, Object.values(globalState.sessions), lastResult);
    System2.undoLast(session, Object.values(globalState.sessions), lastResult);
    System3.undoLast(session, Object.values(globalState.sessions), lastResult);
    
    // 2. Xóa lịch sử chung
    session.history.pop();
    
    // 3. Lưu và Cập nhật UI
    saveSessions();
    updateAllUI();
}

/**
 * Hàm điều phối chính khi Xóa Lịch Sử.
 */
function clearCurrentSessionHistory() {
    if (!globalState.currentSessionId) return;
    const session = globalState.sessions[globalState.currentSessionId];
    
    // 1. Xóa lịch sử chung
    session.history = [];
    
    // 2. Yêu cầu cả 3 hệ thống tự reset
    System1.clearHistory(session);
    System2.clearHistory(session);
    System3.clearHistory(session);
    
    // 3. Lưu và Cập nhật UI
    saveSessions();
    updateAllUI();
}

/**
 * Hàm điều phối cập nhật TOÀN BỘ Giao diện.
 */
function updateAllUI() {
    if (!globalState.currentSessionId || !globalState.sessions[globalState.currentSessionId]) {
        // Có thể xảy ra nếu tất cả phiên bị xóa
        updateBigRoadUI(); // Cập nhật bảng Big Road (sẽ trống)
        updateSessionSelector(); // Cập nhật selector (sẽ trống)
        return;
    }
    
    const session = globalState.sessions[globalState.currentSessionId];
    const allSessions = Object.values(globalState.sessions);
    
    // 1. Cập nhật các thành phần UI chung
    updateBigRoadUI();
    updateSessionSelector();
    
    // 2. Yêu cầu cả 3 hệ thống tự cập nhật UI của chúng
    System1.updateAllUI(session, allSessions);
    System2.updateAllUI(session, allSessions);
    System3.updateAllUI(session, allSessions);
}

// --- SHARED UI FUNCTIONS ---

function updateBigRoadUI() {
    const history = globalState.sessions[globalState.currentSessionId]?.history || [];
    const roadDiv = document.getElementById('bigRoadDisplay');
    document.getElementById('totalGames').textContent = history.length;
    
    if (history.length === 0) {
        roadDiv.innerHTML = '<p class="text-gray-500 p-4">Chưa có kết quả...</p>';
        roadDiv.style.display = 'block';
        return;
    }
    roadDiv.style.display = 'grid';
    roadDiv.innerHTML = '';
    const columns = [];
    if (history.length > 0) {
        let currentCol = [history[0]];
        for (let i = 1; i < history.length; i++) {
            if (history[i] === history[i - 1]) currentCol.push(history[i]);
            else { columns.push(currentCol); currentCol = [history[i]]; }
        }
        columns.push(currentCol);
    }
    columns.forEach(colData => {
        const colDiv = document.createElement('div');
        colDiv.className = 'road-col';
        colData.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `road-item ${item === 'P' ? 'bg-blue-600' : 'bg-red-600'}`;
            itemDiv.textContent = item;
            colDiv.appendChild(itemDiv);
        });
        roadDiv.appendChild(colDiv);
    });
    roadDiv.scrollLeft = roadDiv.scrollWidth;
}

function updateSessionSelector() {
    const selector = document.getElementById('sessionSelector');
    selector.innerHTML = '';
    const sortedKeys = Object.keys(globalState.sessions).sort((a, b) => {
        const timeA = parseInt(a.split('-')[1] || 0);
        const timeB = parseInt(b.split('-')[1] || 0);
        return timeA - timeB;
    });
    sortedKeys.reverse().forEach(sessionId => {
        const session = globalState.sessions[sessionId];
        if (!session) return; // Bỏ qua nếu phiên không tồn tại
        const option = document.createElement('option');
        option.value = sessionId;
        option.textContent = `${session.name} (${session.history.length} ván)`;
        if (sessionId === globalState.currentSessionId) {
            option.selected = true;
        }
        selector.appendChild(option);
    });
    selector.onclick = () => {
        if (selector.selectedOptions.length === 1) {
            if (selector.value !== globalState.currentSessionId) {
                loadSession(selector.value);
            }
        }
    };
}

function toggleSessionManagement() {
    const content = document.getElementById('sessionManagementContent');
    const icon = document.getElementById('toggleSessionIcon');
    if (content.style.maxHeight && content.style.maxHeight !== '0px') {
        content.style.maxHeight = '0px';
        icon.style.transform = 'rotate(-180deg)';
    } else {
        content.style.maxHeight = content.scrollHeight + 'px';
        icon.style.transform = 'rotate(0deg)';
    }
}

// --- CUSTOM UI COMPONENTS (MODAL, TOAST, PROMPT) ---
// (Sao chép từ HỆ THỐNG 1)

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = { success: 'border-green-500', info: 'border-blue-500', warning: 'border-yellow-500', error: 'border-red-500' };
    toast.className = `toast-notification ${colors[type]}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function showLoadingModal(message) {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
<div id="loading-modal" class="modal-backdrop">
<div class="modal-content text-center">
<p class="text-lg text-gray-200">${message}</p>
<div class="mt-4">
<svg class="animate-spin h-8 w-8 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>
</div>
</div>
</div>`;
}

function hideLoadingModal() {
    const modal = document.getElementById('loading-modal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => { document.getElementById('modal-container').innerHTML = ''; }, 300);
    } else {
        document.getElementById('modal-container').innerHTML = '';
    }
}

function showCustomConfirm(message, onConfirm) {
    const container = document.getElementById('modal-container');
    const modalHTML = `
<div id="custom-confirm" class="modal-backdrop">
<div class="modal-content">
<p class="text-lg text-gray-200 mb-6">${message}</p>
<div class="flex justify-end gap-4">
<button id="confirm-cancel" class="btn bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg">Hủy</button>
<button id="confirm-ok" class="btn bg-red-600 hover:bg-red-500 px-6 py-2 rounded-lg">Xác nhận</button>
</div>
</div>
</div>`;
    container.innerHTML = modalHTML;
    const modalElement = document.getElementById('custom-confirm');
    document.getElementById('confirm-ok').onclick = () => {
        onConfirm();
        modalElement.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => { container.innerHTML = ''; }, 300);
    };
    document.getElementById('confirm-cancel').onclick = () => {
        modalElement.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => { container.innerHTML = ''; }, 300);
    };
}

function showCustomPrompt(message, defaultValue, onConfirm) {
    const container = document.getElementById('modal-container');
    const modalHTML = `
<div id="custom-prompt" class="modal-backdrop">
<div class="modal-content">
<p class="text-lg text-gray-200 mb-4">${message}</p>
<input type="text" id="prompt-input" value="${defaultValue}" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none mb-6">
<div class="flex justify-end gap-4">
<button id="prompt-cancel" class="btn bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg">Hủy</button>
<button id="prompt-ok" class="btn bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg">Lưu</button>
</div>
</div>
</div>`;
    container.innerHTML = modalHTML;
    const modalElement = document.getElementById('custom-prompt');
    const input = document.getElementById('prompt-input');
    input.focus(); input.select();
    const closePrompt = (value) => {
        modalElement.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => { container.innerHTML = ''; if (value !== null) onConfirm(value); }, 300);
    };
    document.getElementById('prompt-ok').onclick = () => { closePrompt(input.value); };
    document.getElementById('prompt-cancel').onclick = () => { closePrompt(null); };
    input.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('prompt-ok').click(); };
}


// --- APP START ---
// Phải chờ 3 tệp system được tải xong
document.addEventListener('DOMContentLoaded', () => {
    // Đảm bảo cả 3 module đã được tải
    if (typeof System1 !== 'undefined' && typeof System2 !== 'undefined' && typeof System3 !== 'undefined') {
        initializeApp();
    } else {
        console.error("LỖI: Không thể tải tất cả các tệp system.js");
        showToast("LỖI: Không thể tải các tệp hệ thống.", "error");
    }
});
