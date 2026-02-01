const API_URL = 'https://schedule-backend-iv0o.onrender.com'; 

const datePicker = document.getElementById('date-picker');
const humanDateText = document.getElementById('human-date');
const scheduleList = document.getElementById('schedule-list');
const emptyMsg = document.getElementById('empty-msg');
const loader = document.getElementById('loader');

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
    // Красивая дата текстом (Среда, 25 октября)
    const dateObj = new Date(date);
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    humanDateText.innerText = dateObj.toLocaleDateString('ru-RU', options);

    try {
        const res = await fetch(`${API_URL}/schedule?date=${date}`);
        const data = await res.json();
        
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
        alert('Ошибка связи с сервером');
    }
}

// СОЗДАНИЕ КАРТОЧКИ
function createPairCard(pair) {
    const div = document.createElement('div');
    div.className = 'schedule-row';
    div.style.position = 'relative'; // Для позиционирования крестика

    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    // Крестик удаления (Только для админа)
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
            <span style="font-size:0.8rem; color:#aaa; display:block;">do ${pair.time_end}</span>
        </div>
        <div class="subject-col">
            ${subjectHTML}
            ${teacherHTML}
            ${uploadBtn}
        </div>
        <div class="actions-col">
            <button class="btn-hw" onclick="openHomework('${pair.id}', '${pair.homework || ''}')">ДЗ</button>
            <button class="btn-le" onclick='openGallery(${JSON.stringify(pair.lectureFiles || [])})'>Лекция (${(pair.lectureFiles || []).length})</button>
        </div>
    `;
    return div;
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
        loadSchedule(date); // Перезагружаем список
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

function openGallery(files) {
    currentLectureFiles = files;
    currentImageIndex = 0;
    
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const galleryControls = document.getElementById('gallery-controls');
    const modal = document.getElementById('modal');

    modalTitle.innerText = "Материалы лекции";
    modalBody.innerHTML = ''; // Очищаем текст ДЗ

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
    
    img.src = currentLectureFiles[currentImageIndex].url; // Берем URL из объекта
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

// --- СТАРЫЕ ФУНКЦИИ (ДЗ, АДМИН, ЗАГРУЗКА ФОТО) ---
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

function openHomework(id, text) {
    document.getElementById('modal-title').innerText = "Домашнее задание";
    document.getElementById('gallery-controls').classList.add('hidden'); // Скрываем галерею
    const modalBody = document.getElementById('modal-body');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    
    if (isAdmin) {
        modalBody.innerHTML = `
            <textarea id="hw-edit-area" style="width:100%; height:150px; background:#333; color:#fff; padding:10px;">${text}</textarea>
            <button onclick="saveHomework('${id}')" style="margin-top:10px; background:green;">Сохранить</button>
        `;
    } else {
        modalBody.innerText = text || "Нет ДЗ";
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
    
    alert('Загрузка фото...');
    await fetch(`${API_URL}/upload-lecture`, { method: 'POST', body: formData });
    alert('Готово!');
    loadSchedule(datePicker.value);
}

function checkAdminMode() {
    if(localStorage.getItem('isAdmin') === 'true') {
        document.getElementById('admin-login-btn').style.background = 'red';
        document.getElementById('admin-login-btn').style.opacity = '1';
        document.getElementById('add-pair-btn').classList.remove('hidden'); // Показываем кнопку "Добавить пару"
    }
}

document.getElementById('admin-login-btn').addEventListener('click', async () => {
    if (localStorage.getItem('isAdmin') === 'true') {
        if(confirm('Выйти?')) { localStorage.removeItem('isAdmin'); location.reload(); }
    } else {
        const l = prompt('Log'); const p = prompt('Pass');
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({login:l, password:p})
        });
        const d = await res.json();
        if(d.success) { localStorage.setItem('isAdmin','true'); location.reload(); }
        else alert('Error');
    }
});