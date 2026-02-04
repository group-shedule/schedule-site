const API_URL = 'https://schedule-backend-iv0o.onrender.com/api';

const datePicker = document.getElementById('date-picker');
const humanDateText = document.getElementById('human-date');
const scheduleList = document.getElementById('schedule-list');
const emptyMsg = document.getElementById('empty-msg');
const loader = document.getElementById('loader');
const notifyBtn = document.getElementById('notify-btn');

let currentScheduleData = [];
let currentLectureFiles = [];
let currentImageIndex = 0;

// Журнал изменений для уведомлений
let changesLog = [];

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;
    loadSchedule(today);
    checkAdminMode();
});

datePicker.addEventListener('change', (e) => loadSchedule(e.target.value));

function changeDate(days) {
    const current = new Date(datePicker.value);
    current.setDate(current.getDate() + days);
    const newDate = current.toISOString().split('T')[0];
    datePicker.value = newDate;
    loadSchedule(newDate);
}

async function loadSchedule(date) {
    const dateObj = new Date(date);
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    humanDateText.innerText = dateObj.toLocaleDateString('ru-RU', options);

    try {
        const res = await fetch(`${API_URL}/schedule?date=${date}`);
        const data = await res.json();
        currentScheduleData = data;
        
        loader.classList.add('hidden');
        scheduleList.innerHTML = '';

        if (data.length === 0) {
            emptyMsg.style.display = 'block';
        } else {
            emptyMsg.style.display = 'none';
            data.forEach(pair => {
                scheduleList.appendChild(createPairCard(pair));
            });
        }
    } catch (e) { console.error(e); }
}

function createPairCard(pair) {
    const div = document.createElement('div');
    div.className = 'schedule-row';
    div.style.position = 'relative'; 

    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    const deleteBtn = isAdmin 
        ? `<button class="delete-pair-btn" onclick="deletePair('${pair.id}')">×</button>` 
        : '';

    const subjectHTML = isAdmin 
        ? `<div contenteditable="true" onblur="updateText('${pair.id}', 'subject', this.innerText)">${pair.subject}</div>`
        : `<strong>${pair.subject}</strong>`;

    const teacherHTML = isAdmin
        ? `<div contenteditable="true" onblur="updateText('${pair.id}', 'teacher', this.innerText)" class="teacher">${pair.teacher}</div>`
        : `<span class="teacher">${pair.teacher}</span>`;
    
    // Передаем название предмета для лога уведомлений
    const uploadBtn = isAdmin
        ? `<label class="upload-btn" style="cursor:pointer; font-size:0.8rem; color:#aaa; display:block; margin-top:5px;">
             📸 Добавить фото
             <input type="file" multiple style="display:none;" onchange="uploadPhotos('${pair.id}', '${pair.subject}', this.files)">
           </label>`
        : '';

    div.innerHTML = `
        ${deleteBtn}
        <div class="time-col">
            <span class="pair-time" style="font-size:1.1rem; color:#00d2ff;">${pair.time_start}</span>
            <span style="font-size:0.8rem; color:#aaa; display:block;">до ${pair.time_end}</span>
        </div>
        <div class="subject-col">
            ${subjectHTML}
            ${teacherHTML}
            ${uploadBtn}
        </div>
        <div class="actions-col">
            <button class="btn-hw" onclick="openHomework('${pair.id}')">ДЗ</button>
            <button class="btn-le" onclick="openGallery('${pair.id}')">Лекция (${(pair.lectureFiles || []).length})</button>
        </div>
    `;
    return div;
}

function formatTextWithLinks(text) {
    if (!text) return "Нет ДЗ";
    let html = text.replace(/\n/g, "<br>");
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return html.replace(urlRegex, (url) => {
        const isTelegram = url.includes('t.me') || url.includes('telegram.me');
        if (isTelegram) {
            return `<a href="${url}" style="color: #00d2ff; text-decoration: underline; word-break: break-all;">${url}</a>`;
        } else {
            return `<a href="${url}" target="_blank" style="color: #00d2ff; text-decoration: underline; word-break: break-all;">${url}</a>`;
        }
    });
}

function openAddModal() { document.getElementById('add-modal').classList.remove('hidden'); }
function closeAddModal() { document.getElementById('add-modal').classList.add('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

async function submitNewPair(e) {
    e.preventDefault();
    const start = document.getElementById('new-start').value;
    const end = document.getElementById('new-end').value;
    const subject = document.getElementById('new-subject').value;
    const teacher = document.getElementById('new-teacher').value;
    const date = datePicker.value;

    try {
        await fetch(`${API_URL}/add-pair`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ date, time_start: start, time_end: end, subject, teacher })
        });
        closeAddModal();
        loadSchedule(date); 
    } catch(e) { alert('Ошибка создания'); }
}

async function deletePair(id) {
    if(!confirm('Точно удалить пару? Все фото лекций тоже сотрутся!')) return;
    try {
        await fetch(`${API_URL}/delete-pair`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id })
        });
        loadSchedule(datePicker.value);
    } catch(e) { alert('Ошибка удаления'); }
}

function openGallery(id) {
    const pair = currentScheduleData.find(p => p.id === id);
    if (!pair) return;
    const files = pair.lectureFiles || [];
    currentLectureFiles = files;
    currentImageIndex = 0;
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const galleryControls = document.getElementById('gallery-controls');
    const modal = document.getElementById('modal');
    modalTitle.innerText = "Материалы лекции";
    modalBody.innerHTML = ''; 
    if (files.length === 0) {
        modalBody.innerText = "Фотографий пока нет.";
        galleryControls.classList.add('hidden');
    } else {
        galleryControls.classList.remove('hidden');
        updateGalleryImage();
    }
    modal.classList.remove('hidden');
}

function updateGalleryImage() {
    const img = document.getElementById('gallery-img');
    const pageNum = document.getElementById('current-page');
    const totalNum = document.getElementById('total-pages');
    img.src = currentLectureFiles[currentImageIndex].url; 
    pageNum.innerText = currentImageIndex + 1;
    totalNum.innerText = currentLectureFiles.length;
}

function nextSlide() {
    if (currentImageIndex < currentLectureFiles.length - 1) {
        currentImageIndex++;
        updateGalleryImage();
    }
}
function prevSlide() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        updateGalleryImage();
    }
}

// ------------------------------------------------------------------
// ЛОГИКА УВЕДОМЛЕНИЙ И СОХРАНЕНИЯ
// ------------------------------------------------------------------

function openHomework(id) {
    const pair = currentScheduleData.find(p => p.id === id);
    if (!pair) return;
    const text = pair.homework;
    document.getElementById('modal-title').innerText = "Домашнее задание";
    document.getElementById('gallery-controls').classList.add('hidden'); 
    const modalBody = document.getElementById('modal-body');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (isAdmin) {
        // Передаем также Название предмета (pair.subject), чтобы добавить в лог
        modalBody.innerHTML = `
            <textarea id="hw-edit-area" style="width:100%; height:150px; background:#333; color:#fff; padding:10px; border:1px solid #555;">${text || ''}</textarea>
            <button onclick="saveHomework('${id}', '${pair.subject}')" style="margin-top:10px; background:green; color:white; padding:10px; border:none; cursor:pointer;">Сохранить</button>
            <p style="font-size:0.8rem; color:#aaa; margin-top:5px;">💡 Ссылки (http/https) станут кликабельными.</p>
        `;
    } else {
        modalBody.innerHTML = formatTextWithLinks(text);
    }
    document.getElementById('modal').classList.remove('hidden');
}

async function saveHomework(id, subjectName) {
    const text = document.getElementById('hw-edit-area').value;
    await fetch(`${API_URL}/update-text`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id, homework: text})
    });
    alert('ДЗ сохранено!');
    
    // ДОБАВЛЯЕМ В ЛОГ
    addToLog(`Добавлено ДЗ: ${subjectName} (${formatDate(datePicker.value)})`);
    
    closeModal();
    loadSchedule(datePicker.value);
}

async function updateText(id, field, value) {
    await fetch(`${API_URL}/update-text`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id, [field]: value})
    });
}

async function uploadPhotos(id, subjectName, files) {
    const formData = new FormData();
    formData.append('id', id);
    for(let i=0; i<files.length; i++) {
        if(files[i].size > 10*1024*1024) { alert(`Файл ${files[i].name} слишком большой! (Лимит 10Мб)`); return; }
        formData.append('photos', files[i]);
    }
    
    alert('Загрузка фото...');
    try {
        const res = await fetch(`${API_URL}/upload-lecture`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            alert('Успешно!');
            // ДОБАВЛЯЕМ В ЛОГ
            addToLog(`Добавлено фото лекций: ${subjectName} (${formatDate(datePicker.value)})`);
            loadSchedule(datePicker.value);
        } else {
            alert('Ошибка сервера: ' + data.error);
        }
    } catch (e) { alert('Ошибка сети'); }
}

// --- УПРАВЛЕНИЕ УВЕДОМЛЕНИЯМИ ---

function addToLog(message) {
    changesLog.push(message);
    updateNotifyButton();
}

function updateNotifyButton() {
    const btn = document.getElementById('notify-btn');
    if (btn) {
        btn.innerText = `📢 Уведомить (${changesLog.length})`;
    }
}

// Красивая дата: 04.02.2026
function formatDate(isoDate) {
    const d = new Date(isoDate);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
}

async function sendNotification() {
    if (changesLog.length === 0) {
        alert("Нет новых изменений для отправки.");
        return;
    }

    const uniqueLog = [...new Set(changesLog)];
    const message = uniqueLog.join('\n'); 

    const confirmText = "Отправить уведомление всем подписчикам?\n\nТекст:\n" + message;
    if (!confirm(confirmText)) return;

    try {
        const res = await fetch(`${API_URL}/notify`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message: message })
        });
        const data = await res.json();
        
        if (data.success) {
            alert("Уведомление отправлено!");
            changesLog = []; 
            updateNotifyButton();
        } else {
            alert("Ошибка отправки: " + JSON.stringify(data));
        }
    } catch (e) {
        alert("Ошибка сети при отправке уведомления.");
    }
}

function checkAdminMode() {
    if(localStorage.getItem('isAdmin') === 'true') {
        const btn = document.getElementById('admin-login-btn');
        btn.style.background = '#dc3545';
        btn.style.opacity = '1';
        document.getElementById('admin-panel-header').classList.remove('hidden');
    }
}

document.getElementById('admin-login-btn').addEventListener('click', async () => {
    if (localStorage.getItem('isAdmin') === 'true') {
        if(confirm('Выйти из режима админа?')) { localStorage.removeItem('isAdmin'); location.reload(); }
    } else {
        const l = prompt('Логин:'); 
        const p = prompt('Пароль:');
        if (!l || !p) return;
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({login:l, password:p})
            });
            const d = await res.json();
            if(d.success) { 
                localStorage.setItem('isAdmin','true'); 
                location.reload(); 
            } else {
                alert('Неверный логин или пароль');
            }
        } catch (e) {
            alert('Ошибка сервера при входе');
        }
    }
});

