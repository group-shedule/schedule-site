const API_URL = 'https://schedule-backend-iv0o.onrender.com/api';

const datePicker = document.getElementById('date-picker');
const humanDay = document.getElementById('human-day');
const humanFullDate = document.getElementById('human-full-date');
const scheduleList = document.getElementById('schedule-list');
const emptyMsg = document.getElementById('empty-msg');
const loader = document.getElementById('loader');
const notifyBtn = document.getElementById('notify-btn');

let currentScheduleData = [];
let currentLectureFiles = [];
let currentImageIndex = 0;
let changesLog = [];
let currentPairIdForGallery = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Устанавливаем дату (Местное время)
    const today = new Date().toLocaleDateString('en-CA'); 
    datePicker.value = today;
    loadSchedule(today);
    checkAdminMode();
});

// Смена даты в календаре
datePicker.addEventListener('change', (e) => loadSchedule(e.target.value));

function changeDate(days) {
    const current = new Date(datePicker.value);
    current.setDate(current.getDate() + days);
    const newDate = current.toLocaleDateString('en-CA');
    datePicker.value = newDate;
    loadSchedule(newDate);
}

// ЗАГРУЗКА РАСПИСАНИЯ
async function loadSchedule(date) {
    // Красивая дата в шапке
    const dateObj = new Date(date);
    humanDay.innerText = dateObj.toLocaleDateString('ru-RU', { weekday: 'long' });
    humanFullDate.innerText = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    try {
        loader.classList.remove('hidden');
        const res = await fetch(`${API_URL}/schedule?date=${date}`);
        const data = await res.json();
        currentScheduleData = data;
        
        loader.classList.add('hidden');
        scheduleList.innerHTML = '';

        if (data.length === 0) {
            emptyMsg.classList.remove('hidden');
        } else {
            emptyMsg.classList.add('hidden');
            data.forEach(pair => {
                scheduleList.appendChild(createPairCard(pair));
            });
        }
    } catch (e) { 
        console.error(e); 
        loader.classList.add('hidden'); 
    }
}

// СОЗДАНИЕ КАРТОЧКИ ПАРЫ
function createPairCard(pair) {
    const div = document.createElement('div');
    div.className = 'schedule-row';

    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    const deleteBtn = isAdmin 
        ? `<button class="delete-pair-btn" onclick="deletePair('${pair.id}')">×</button>` 
        : '';

    const subjectHTML = isAdmin 
        ? `<h3 contenteditable="true" onblur="updateText('${pair.id}', 'subject', this.innerText)">${pair.subject}</h3>`
        : `<h3>${pair.subject}</h3>`;

    const teacherHTML = isAdmin
        ? `<div contenteditable="true" onblur="updateText('${pair.id}', 'teacher', this.innerText)" class="teacher">${pair.teacher}</div>`
        : `<div class="teacher">${pair.teacher}</div>`;
    
    const uploadBtn = isAdmin
        ? `<label class="upload-label">
             📸 Фото
             <input type="file" multiple style="display:none;" onchange="uploadPhotos('${pair.id}', '${pair.subject}', this.files)">
           </label>`
        : '';

    div.innerHTML = `
        <div class="pair-meta">
            <div class="time-badge">
                ${pair.time_start} <span class="duration">- ${pair.time_end}</span>
            </div>
            ${deleteBtn}
        </div>
        
        <div class="pair-content">
            ${subjectHTML}
            ${teacherHTML}
            ${uploadBtn}
        </div>
        
        <div class="pair-actions">
            <button class="btn-action btn-hw" onclick="openHomework('${pair.id}')">ДЗ</button>
            <button class="btn-action btn-le" onclick="openGallery('${pair.id}')">Лекции (${(pair.lectureFiles || []).length})</button>
        </div>
    `;
    return div;
}

// ФУНКЦИЯ ПРЕВРАЩЕНИЯ ССЫЛОК В КЛИКАБЕЛЬНЫЕ
function formatTextWithLinks(text) {
    if (!text) return "Нет ДЗ";
    try {
        let html = String(text).replace(/\n/g, "<br>");
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        
        return html.replace(urlRegex, (url) => {
            const isTelegram = url.includes('t.me') || url.includes('telegram.me');
            if (isTelegram) {
                return `<a href="${url}">${url}</a>`;
            } else {
                return `<a href="${url}" target="_blank">${url}</a>`;
            }
        });
    } catch (e) {
        return String(text);
    }
}

// --- УПРАВЛЕНИЕ ФОТО (ГАЛЕРЕЯ) ---

function openGallery(id) {
    const pair = currentScheduleData.find(p => p.id === id);
    if (!pair) return;
    currentPairIdForGallery = id;
    currentLectureFiles = pair.lectureFiles || [];
    currentImageIndex = 0;
    
    document.getElementById('modal-title').innerText = "Материалы лекции";
    document.getElementById('modal-body').innerHTML = ''; 
    
    const galleryControls = document.getElementById('gallery-controls');
    const photoActions = document.getElementById('photo-actions');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    if (currentLectureFiles.length === 0) {
        document.getElementById('modal-body').innerText = "Фотографий пока нет.";
        galleryControls.classList.add('hidden');
    } else {
        galleryControls.classList.remove('hidden');
        if(isAdmin) photoActions.classList.remove('hidden'); 
        else photoActions.classList.add('hidden');
        updateGalleryImage();
    }
    document.getElementById('modal').classList.remove('hidden');
}

async function deleteCurrentPhoto() {
    if(!confirm('Удалить это фото?')) return;
    const currentFile = currentLectureFiles[currentImageIndex];
    loader.classList.remove('hidden');
    
    try {
        await fetch(`${API_URL}/delete-single-image`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                doc_id: currentPairIdForGallery, 
                image_id: currentFile.id,
                image_url: currentFile.url
            })
        });
        
        // Обновляем список локально
        currentLectureFiles.splice(currentImageIndex, 1);
        if (currentImageIndex >= currentLectureFiles.length) currentImageIndex = Math.max(0, currentLectureFiles.length - 1);
        
        loadSchedule(datePicker.value);
        
        if (currentLectureFiles.length === 0) {
            document.getElementById('modal').classList.add('hidden');
        } else {
            updateGalleryImage();
        }
    } catch(e) { alert('Ошибка при удалении'); }
    loader.classList.add('hidden');
}

async function rotateCurrentPhoto() {
    const currentFile = currentLectureFiles[currentImageIndex];
    loader.classList.remove('hidden');
    
    try {
        const res = await fetch(`${API_URL}/rotate-image`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                doc_id: currentPairIdForGallery, 
                image_url: currentFile.url,
                image_id: currentFile.id
            })
        });
        const data = await res.json();
        
        if (data.success) {
            currentLectureFiles[currentImageIndex].url = data.new_url;
            updateGalleryImage();
            loadSchedule(datePicker.value);
        }
    } catch(e) { alert('Ошибка при повороте'); }
    loader.classList.add('hidden');
}

function updateGalleryImage() {
    const img = document.getElementById('gallery-img');
    img.src = currentLectureFiles[currentImageIndex].url; 
    document.getElementById('current-page').innerText = currentImageIndex + 1;
    document.getElementById('total-pages').innerText = currentLectureFiles.length;
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

// --- НЕДЕЛЬНЫЕ ШАБЛОНЫ ---

function getMonday(d) {
  d = new Date(d);
  var day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

async function saveCurrentWeekAsTemplate() {
    const name = prompt("Название шаблона (например: 'Числитель'):");
    if (!name) return;
    
    loader.classList.remove('hidden');
    const monday = getMonday(datePicker.value);
    let weekPairs = [];

    try {
        for (let i = 0; i < 6; i++) {
            let tempDate = new Date(monday);
            tempDate.setDate(monday.getDate() + i);
            const dateStr = tempDate.toLocaleDateString('en-CA');
            
            const res = await fetch(`${API_URL}/schedule?date=${dateStr}`);
            const data = await res.json();
            
            data.forEach(p => { 
                p.day_index = i; 
                weekPairs.push(p); 
            });
        }

        if (weekPairs.length === 0) {
            alert("Неделя пустая, нечего сохранять.");
            loader.classList.add('hidden');
            return;
        }

        await fetch(`${API_URL}/save-template`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name: name, pairs: weekPairs })
        });
        alert('Недельный шаблон сохранен!');
    } catch(e) { alert('Ошибка сохранения'); }
    loader.classList.add('hidden');
}

async function openTemplateModal() {
    document.getElementById('template-modal').classList.remove('hidden');
    const list = document.getElementById('templates-list');
    list.innerHTML = 'Загрузка...';
    
    try {
        const res = await fetch(`${API_URL}/templates`);
        const data = await res.json();
        list.innerHTML = '';
        if (data.length === 0) list.innerHTML = '<p style="color:#aaa;">Нет шаблонов</p>';
        
        data.forEach(tmpl => {
            const div = document.createElement('div');
            div.className = 'template-item';
            div.innerHTML = `
                <span>${tmpl.name}</span>
                <div>
                    <button class="btn-load" onclick='applyTemplate(${JSON.stringify(tmpl.pairs)})'>Загрузить</button>
                    <button class="btn-del-tmpl" onclick="deleteTemplate('${tmpl.id}')">🗑️</button>
                </div>
            `;
            list.appendChild(div);
        });
    } catch(e) { list.innerHTML = 'Ошибка'; }
}

async function applyTemplate(pairs) {
    if(!confirm('Загрузить шаблон на эту неделю? (Текущие пары не удалятся, а добавятся)')) return;
    closeTemplateModal();
    loader.classList.remove('hidden');
    
    const monday = getMonday(datePicker.value);
    
    try {
        for (let p of pairs) {
            let targetDate = new Date(monday);
            targetDate.setDate(monday.getDate() + p.day_index);
            const dateStr = targetDate.toLocaleDateString('en-CA');

            await fetch(`${API_URL}/add-pair`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    date: dateStr, 
                    time_start: p.time_start, 
                    time_end: p.time_end, 
                    subject: p.subject, 
                    teacher: p.teacher 
                })
            });
        }
        loadSchedule(datePicker.value);
        alert("Расписание загружено!");
    } catch(e) { alert("Ошибка загрузки"); }
    loader.classList.add('hidden');
}

async function deleteTemplate(id) {
    if(!confirm('Удалить шаблон?')) return;
    await fetch(`${API_URL}/delete-template`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id})
    });
    openTemplateModal();
}

function closeTemplateModal() { document.getElementById('template-modal').classList.add('hidden'); }

// --- СТАНДАРТНЫЕ ФУНКЦИИ (ПОЛНЫЕ) ---

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
            body: JSON.stringify({ date: date, time_start: start, time_end: end, subject: subject, teacher: teacher })
        });
        closeAddModal();
        loadSchedule(date); 
    } catch(e) { alert('Ошибка создания'); }
}

async function deletePair(id) {
    if(!confirm('Точно удалить пару?')) return;
    try {
        await fetch(`${API_URL}/delete-pair`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id })
        });
        loadSchedule(datePicker.value);
    } catch(e) { alert('Ошибка удаления'); }
}

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
            <textarea id="hw-edit-area" style="width:100%; height:150px; background:rgba(0,0,0,0.3); color:#fff; padding:10px; border:1px solid #555; border-radius:10px;">${text || ''}</textarea>
            <button onclick="saveHomework('${id}', '${pair.subject}')" style="margin-top:10px; background:#10b981; color:white; padding:10px; border:none; border-radius:10px; cursor:pointer; width:100%;">Сохранить</button>
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
        if(files[i].size > 10*1024*1024) { alert(`Файл ${files[i].name} слишком большой!`); return; }
        formData.append('photos', files[i]);
    }
    
    loader.classList.remove('hidden');
    try {
        const res = await fetch(`${API_URL}/upload-lecture`, { method: 'POST', body: formData });
        const data = await res.json();
        
        loader.classList.add('hidden');
        if (data.success) {
            addToLog(`Добавлено фото лекций: ${subjectName} (${formatDate(datePicker.value)})`);
            loadSchedule(datePicker.value);
        } else {
            alert('Ошибка сервера: ' + data.error);
        }
    } catch (e) { 
        loader.classList.add('hidden'); 
        alert('Ошибка сети'); 
    }
}

// УВЕДОМЛЕНИЯ

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

    if (!confirm("Отправить уведомление подписчикам?\n\n" + message)) return;

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
        btn.style.background = '#ef4444';
        btn.style.opacity = '1';
        document.getElementById('admin-panel').classList.remove('hidden');
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
