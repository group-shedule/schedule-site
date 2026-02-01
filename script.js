// Ссылка на твой сервер
const API_URL = 'https://schedule-backend-iv0o.onrender.com/api';

const datePicker = document.getElementById('date-picker');
const humanDateText = document.getElementById('human-date');
const scheduleList = document.getElementById('schedule-list');
const emptyMsg = document.getElementById('empty-msg');
const loader = document.getElementById('loader');

// Глобальная переменная для хранения текущего расписания
let currentScheduleData = [];

// Галерея
let currentLectureFiles = [];
let currentImageIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Устанавливаем дату "Сегодня"
    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;
    
    // 2. Грузим расписание
    loadSchedule(today);
    
    // 3. Проверяем админа
    checkAdminMode();
});

// Смена даты в календаре
datePicker.addEventListener('change', (e) => loadSchedule(e.target.value));

// Кнопки влево-вправо (день)
function changeDate(days) {
    const current = new Date(datePicker.value);
    current.setDate(current.getDate() + days);
    const newDate = current.toISOString().split('T')[0];
    datePicker.value = newDate;
    loadSchedule(newDate);
}

// ЗАГРУЗКА РАСПИСАНИЯ
async function loadSchedule(date) {
    // Красивая дата текстом
    const dateObj = new Date(date);
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    humanDateText.innerText = dateObj.toLocaleDateString('ru-RU', options);

    try {
        const res = await fetch(`${API_URL}/schedule?date=${date}`);
        const data = await res.json();
        
        // СОХРАНЯЕМ ДАННЫЕ В ПАМЯТЬ
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
    } catch (e) {
        console.error(e);
    }
}

// СОЗДАНИЕ КАРТОЧКИ
function createPairCard(pair) {
    const div = document.createElement('div');
    div.className = 'schedule-row';
    div.style.position = 'relative'; 

    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    // Крестик удаления
    const deleteBtn = isAdmin 
        ? `<button class="delete-pair-btn" onclick="deletePair('${pair.id}')">×</button>` 
        : '';

    const subjectHTML = isAdmin 
        ? `<div contenteditable="true" onblur="updateText('${pair.id}', 'subject', this.innerText)">${pair.subject}</div>`
        : `<strong>${pair.subject}</strong>`;

    const teacherHTML = isAdmin
        ? `<div contenteditable="true" onblur="updateText('${pair.id}', 'teacher', this.innerText)" class="teacher">${pair.teacher}</div>`
        : `<span class="teacher">${pair.teacher}</span>`;
    
    const uploadBtn = isAdmin
        ? `<label class="upload-btn" style="cursor:pointer; font-size:0.8rem; color:#aaa; display:block; margin-top:5px;">
             📸 Добавить фото
             <input type="file" multiple style="display:none;" onchange="uploadPhotos('${pair.id}', this.files)">
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

// --- НОВАЯ ФУНКЦИЯ: ПРЕВРАЩАЕМ ТЕКСТ В КЛИКАБЕЛЬНЫЕ ССЫЛКИ ---
function formatTextWithLinks(text) {
    if (!text) return "Нет ДЗ";
    
    let html = text.replace(/\n/g, "<br>");
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    return html.replace(urlRegex, (url) => {
        // Проверяем, это ссылка на телеграм или нет?
        const isTelegram = url.includes('t.me') || url.includes('telegram.me');

        if (isTelegram) {
            // Если Телеграм - убираем target="_blank", чтобы телефон переключил приложение
            return `<a href="${url}" style="color: #00d2ff; text-decoration: underline; word-break: break-all;">${url}</a>`;
        } else {
            // Если обычный сайт - открываем в новой вкладке
            return `<a href="${url}" target="_blank" style="color: #00d2ff; text-decoration: underline; word-break: break-all;">${url}</a>`;
        }
    });
}

// --- ЛОГИКА ДОБАВЛЕНИЯ/УДАЛЕНИЯ ---

function openAddModal() {
    document.getElementById('add-modal').classList.remove('hidden');
}
function closeAddModal() {
    document.getElementById('add-modal').classList.add('hidden');
}

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

// --- ГАЛЕРЕЯ (СЛАЙДЕР) ---

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

// --- ДЗ, АДМИН, ЗАГРУЗКА ФОТО ---

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

function openHomework(id) {
    const pair = currentScheduleData.find(p => p.id === id);
    if (!pair) return;

    const text = pair.homework;

    document.getElementById('modal-title').innerText = "Домашнее задание";
    document.getElementById('gallery-controls').classList.add('hidden'); 
    const modalBody = document.getElementById('modal-body');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    
    if (isAdmin) {
        modalBody.innerHTML = `
            <textarea id="hw-edit-area" style="width:100%; height:150px; background:#333; color:#fff; padding:10px; border:1px solid #555;">${text || ''}</textarea>
            <button onclick="saveHomework('${id}')" style="margin-top:10px; background:green; color:white; padding:10px; border:none; cursor:pointer;">Сохранить</button>
            <p style="font-size:0.8rem; color:#aaa; margin-top:5px;">💡 Ссылки (http/https) станут кликабельными при просмотре.</p>
        `;
    } else {
        // ИСПОЛЬЗУЕМ НОВУЮ ФУНКЦИЮ ДЛЯ ССЫЛОК
        modalBody.innerHTML = formatTextWithLinks(text);
    }
    document.getElementById('modal').classList.remove('hidden');
}

async function saveHomework(id) {
    const text = document.getElementById('hw-edit-area').value;
    await fetch(`${API_URL}/update-text`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id, homework: text})
    });
    alert('ДЗ сохранено!');
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

async function uploadPhotos(id, files) {
    const formData = new FormData();
    formData.append('id', id);
    for(let f of files) formData.append('photos', f);
    
    alert('Загрузка фото... Подождите.');
    await fetch(`${API_URL}/upload-lecture`, { method: 'POST', body: formData });
    alert('Фото успешно загружены!');
    loadSchedule(datePicker.value);
}

function checkAdminMode() {
    if(localStorage.getItem('isAdmin') === 'true') {
        const btn = document.getElementById('admin-login-btn');
        btn.style.background = '#dc3545';
        btn.style.opacity = '1';
        document.getElementById('add-pair-btn').classList.remove('hidden'); 
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

