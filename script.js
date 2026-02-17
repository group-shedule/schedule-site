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
    const today = new Date().toLocaleDateString('en-CA'); 
    datePicker.value = today;
    loadSchedule(today);
    checkAdminMode();
});

datePicker.addEventListener('change', (e) => loadSchedule(e.target.value));

function changeDate(days) {
    const current = new Date(datePicker.value);
    current.setDate(current.getDate() + days);
    const newDate = current.toLocaleDateString('en-CA');
    datePicker.value = newDate;
    loadSchedule(newDate);
}

async function loadSchedule(date) {
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
    } catch (e) { console.error(e); loader.classList.add('hidden'); }
}

function createPairCard(pair) {
    const div = document.createElement('div');
    div.className = 'schedule-row';
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    const deleteBtn = isAdmin ? `<button class="delete-pair-btn" onclick="deletePair('${pair.id}')">×</button>` : '';
    const subjectHTML = isAdmin 
        ? `<h3 contenteditable="true" onblur="updateText('${pair.id}', 'subject', this.innerText)">${pair.subject}</h3>`
        : `<h3>${pair.subject}</h3>`;
    const teacherHTML = isAdmin
        ? `<div contenteditable="true" onblur="updateText('${pair.id}', 'teacher', this.innerText)" class="teacher">${pair.teacher}</div>`
        : `<div class="teacher">${pair.teacher}</div>`;
    const uploadBtn = isAdmin
        ? `<label class="upload-label">📸 Фото<input type="file" multiple style="display:none;" onchange="uploadPhotos('${pair.id}', '${pair.subject}', this.files)"></label>`
        : '';

    div.innerHTML = `
        <div class="pair-meta">
            <div class="time-badge">${pair.time_start} <span class="duration">- ${pair.time_end}</span></div>
            ${deleteBtn}
        </div>
        <div class="pair-content">${subjectHTML} ${teacherHTML} ${uploadBtn}</div>
        <div class="pair-actions">
            <button class="btn-action btn-hw" onclick="openHomework('${pair.id}')">ДЗ</button>
            <button class="btn-action btn-le" onclick="openGallery('${pair.id}')">Лекции (${(pair.lectureFiles || []).length})</button>
        </div>
    `;
    return div;
}

// --- ФОТО ---
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
        if(isAdmin) photoActions.classList.remove('hidden'); else photoActions.classList.add('hidden');
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
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ doc_id: currentPairIdForGallery, image_id: currentFile.id, image_url: currentFile.url })
        });
        currentLectureFiles.splice(currentImageIndex, 1);
        if (currentImageIndex >= currentLectureFiles.length) currentImageIndex = Math.max(0, currentLectureFiles.length - 1);
        loadSchedule(datePicker.value);
        if (currentLectureFiles.length === 0) document.getElementById('modal').classList.add('hidden');
        else updateGalleryImage();
    } catch(e) { alert('Ошибка'); }
    loader.classList.add('hidden');
}

async function rotateCurrentPhoto() {
    const currentFile = currentLectureFiles[currentImageIndex];
    loader.classList.remove('hidden');
    try {
        const res = await fetch(`${API_URL}/rotate-image`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ doc_id: currentPairIdForGallery, image_url: currentFile.url, image_id: currentFile.id })
        });
        const data = await res.json();
        if (data.success) {
            currentLectureFiles[currentImageIndex].url = data.new_url;
            updateGalleryImage();
            loadSchedule(datePicker.value);
        }
    } catch(e) { alert('Ошибка'); }
    loader.classList.add('hidden');
}

function updateGalleryImage() {
    const img = document.getElementById('gallery-img');
    img.src = currentLectureFiles[currentImageIndex].url; 
    document.getElementById('current-page').innerText = currentImageIndex + 1;
    document.getElementById('total-pages').innerText = currentLectureFiles.length;
}
function nextSlide() { if(currentImageIndex < currentLectureFiles.length-1) { currentImageIndex++; updateGalleryImage(); } }
function prevSlide() { if(currentImageIndex > 0) { currentImageIndex--; updateGalleryImage(); } }

// --- ШАБЛОНЫ (НЕДЕЛЯ) ---
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
            data.forEach(p => { p.day_index = i; weekPairs.push(p); });
        }
        if (weekPairs.length === 0) { alert("Неделя пустая."); loader.classList.add('hidden'); return; }
        await fetch(`${API_URL}/save-template`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name: name, pairs: weekPairs }) });
        alert('Шаблон сохранен!');
    } catch(e) { alert('Ошибка'); }
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
            div.innerHTML = `<span>${tmpl.name}</span><div><button class="btn-load" onclick='applyTemplate(${JSON.stringify(tmpl.pairs)})'>Загрузить</button><button class="btn-del-tmpl" onclick="deleteTemplate('${tmpl.id}')">🗑️</button></div>`;
            list.appendChild(div);
        });
    } catch(e) { list.innerHTML = 'Ошибка'; }
}

async function applyTemplate(pairs) {
    if(!confirm('Загрузить шаблон на эту неделю?')) return;
    closeTemplateModal();
    loader.classList.remove('hidden');
    const monday = getMonday(datePicker.value);
    try {
        for (let p of pairs) {
            let targetDate = new Date(monday);
            targetDate.setDate(monday.getDate() + p.day_index);
            await fetch(`${API_URL}/add-pair`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ date: targetDate.toLocaleDateString('en-CA'), time_start: p.time_start, time_end: p.time_end, subject: p.subject, teacher: p.teacher })
            });
        }
        loadSchedule(datePicker.value);
        alert("Загружено!");
    } catch(e) { alert("Ошибка"); }
    loader.classList.add('hidden');
}

async function deleteTemplate(id) {
    if(!confirm('Удалить?')) return;
    await fetch(`${API_URL}/delete-template`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id}) });
    openTemplateModal(); 
}
function closeTemplateModal() { document.getElementById('template-modal').classList.add('hidden'); }

// --- СТАНДАРТНЫЕ ---
function openAddModal() { document.getElementById('add-modal').classList.remove('hidden'); }
function closeAddModal() { document.getElementById('add-modal').classList.add('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
async function submitNewPair(e) { e.preventDefault(); /* ... */ const start = document.getElementById('new-start').value; const end = document.getElementById('new-end').value; const subject = document.getElementById('new-subject').value; const teacher = document.getElementById('new-teacher').value; try { await fetch(`${API_URL}/add-pair`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ date: datePicker.value, time_start: start, time_end: end, subject, teacher }) }); closeAddModal(); loadSchedule(datePicker.value); } catch(e){} }
async function deletePair(id) { if(!confirm('Удалить?')) return; try { await fetch(`${API_URL}/delete-pair`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id }) }); loadSchedule(datePicker.value); } catch(e){} }
function openHomework(id) { const pair = currentScheduleData.find(p => p.id === id); if (!pair) return; document.getElementById('modal-title').innerText = "Домашнее задание"; document.getElementById('gallery-controls').classList.add('hidden'); const modalBody = document.getElementById('modal-body'); if (localStorage.getItem('isAdmin') === 'true') { modalBody.innerHTML = `<textarea id="hw-edit-area" style="width:100%; height:150px; background:rgba(0,0,0,0.3); color:#fff; padding:10px; border:1px solid #555; border-radius:10px;">${pair.homework || ''}</textarea><button onclick="saveHomework('${id}', '${pair.subject}')" style="margin-top:10px; background:#10b981; color:white; padding:10px; border:none; border-radius:10px; cursor:pointer; width:100%;">Сохранить</button>`; } else { modalBody.innerHTML = formatTextWithLinks(pair.homework); } document.getElementById('modal').classList.remove('hidden'); }
async function saveHomework(id, subjectName) { const text = document.getElementById('hw-edit-area').value; await fetch(`${API_URL}/update-text`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, homework: text}) }); alert('Сохранено'); addToLog(`Добавлено ДЗ: ${subjectName} (${formatDate(datePicker.value)})`); closeModal(); loadSchedule(datePicker.value); }
async function updateText(id, f, v) { await fetch(`${API_URL}/update-text`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, [f]: v}) }); }
async function uploadPhotos(id, subjectName, files) { const formData = new FormData(); formData.append('id', id); for(let i=0; i<files.length; i++) { if(files[i].size > 10*1024*1024) { alert('Файл большой!'); return; } formData.append('photos', files[i]); } loader.classList.remove('hidden'); try { const res = await fetch(`${API_URL}/upload-lecture`, { method: 'POST', body: formData }); const data = await res.json(); if(data.success) { addToLog(`Фото лекций: ${subjectName} (${formatDate(datePicker.value)})`); loadSchedule(datePicker.value); } else alert(data.error); } catch(e){ alert('Ошибка'); } loader.classList.add('hidden'); }
function addToLog(m) { changesLog.push(m); updateNotifyButton(); }
function updateNotifyButton() { const btn = document.getElementById('notify-btn'); if(btn) btn.innerText = `📢 Уведомить (${changesLog.length})`; }
function formatDate(isoDate) { const d = new Date(isoDate); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; }
async function sendNotification() { if(!changesLog.length) return; const msg = [...new Set(changesLog)].join('\n'); if(!confirm("Отправить?\n"+msg)) return; try { const res = await fetch(`${API_URL}/notify`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ message: msg }) }); const d = await res.json(); if(d.success) { alert("Отправлено!"); changesLog=[]; updateNotifyButton(); } } catch(e){} }
function checkAdminMode() { if(localStorage.getItem('isAdmin')==='true') { document.getElementById('admin-login-btn').style.background='#ef4444'; document.getElementById('admin-panel').classList.remove('hidden'); } }
document.getElementById('admin-login-btn').addEventListener('click', async () => { if(localStorage.getItem('isAdmin')==='true'){ if(confirm('Выйти?')){ localStorage.removeItem('isAdmin'); location.reload(); }} else { const l=prompt('Логин'); const p=prompt('Пароль'); if(l&&p){ const r=await fetch(`${API_URL}/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:l,password:p})}); const d=await r.json(); if(d.success){ localStorage.setItem('isAdmin','true'); location.reload(); } else alert('Ошибка'); } } });
