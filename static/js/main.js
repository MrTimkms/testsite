// Элементы DOM
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImage');
const processBtn = document.getElementById('processBtn');
const resultSection = document.getElementById('resultSection');
const resultContent = document.getElementById('resultContent');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// Элементы каталога дисков
const brandFilter = document.getElementById('brandFilter');
const searchInput = document.getElementById('searchInput');
const discsGrid = document.getElementById('discsGrid');
const catalogLoading = document.getElementById('catalogLoading');
const catalogEmpty = document.getElementById('catalogEmpty');
const pagination = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const selectedDisc = document.getElementById('selectedDisc');
const selectedDiscName = document.getElementById('selectedDiscName');

// Состояние приложения
let selectedImageBase64 = null;
let selectedDiscId = null;
let currentPage = 1;
let currentFilters = {
    brand: '',
    search: ''
};
let searchTimeout = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadBrands();
    loadDiscs();
    
    // Обработчики фильтров
    brandFilter.addEventListener('change', () => {
        currentFilters.brand = brandFilter.value;
        currentPage = 1;
        loadDiscs();
    });
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentFilters.search = e.target.value.trim();
            currentPage = 1;
            loadDiscs();
        }, 500); // Debounce на 500ms
    });
    
    // Пагинация
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadDiscs();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        currentPage++;
        loadDiscs();
    });
});

// Загрузка списка брендов
async function loadBrands() {
    try {
        const response = await fetch('/api/discs/brands');
        const data = await response.json();
        
        if (response.ok && data.brands) {
            brandFilter.innerHTML = '<option value="">Все бренды</option>';
            data.brands.forEach(brand => {
                const option = document.createElement('option');
                option.value = brand;
                option.textContent = brand;
                brandFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки брендов:', error);
    }
}

// Загрузка списка дисков
async function loadDiscs() {
    catalogLoading.style.display = 'block';
    discsGrid.style.display = 'none';
    catalogEmpty.style.display = 'none';
    pagination.style.display = 'none';
    
    try {
        const params = new URLSearchParams({
            page: currentPage,
            per_page: 20
        });
        
        if (currentFilters.brand) {
            params.append('brand', currentFilters.brand);
        }
        if (currentFilters.search) {
            params.append('search', currentFilters.search);
        }
        
        const response = await fetch(`/api/discs?${params}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка загрузки дисков');
        }
        
        catalogLoading.style.display = 'none';
        
        if (data.discs && data.discs.length > 0) {
            displayDiscs(data.discs);
            updatePagination(data.pagination);
            discsGrid.style.display = 'grid';
        } else {
            catalogEmpty.style.display = 'block';
        }
        
    } catch (error) {
        catalogLoading.style.display = 'none';
        showError('Ошибка загрузки каталога: ' + error.message);
    }
}

// Отображение дисков
function displayDiscs(discs) {
    discsGrid.innerHTML = '';
    
    discs.forEach(disc => {
        const discItem = document.createElement('div');
        discItem.className = 'disc-item';
        discItem.dataset.discId = disc._id;
        
        if (selectedDiscId === disc._id) {
            discItem.classList.add('selected');
        }
        
        const specs = [];
        if (disc.diameter) specs.push(`⌀${disc.diameter}"`);
        if (disc.width) specs.push(`${disc.width}J`);
        if (disc.pcd) specs.push(`PCD ${disc.pcd}`);
        
        discItem.innerHTML = `
            <div class="disc-item-image">
                ${disc.image_url ? 
                    `<img src="${disc.image_url}" alt="${disc.model_name || disc.brand}" onerror="this.parentElement.innerHTML='🛞'">` : 
                    '🛞'}
            </div>
            <div class="disc-item-name">${disc.model_name || 'Модель не указана'}</div>
            <div class="disc-item-brand">${disc.brand || 'Бренд не указан'}</div>
            ${specs.length > 0 ? `<div class="disc-item-specs">${specs.join(' • ')}</div>` : ''}
        `;
        
        discItem.addEventListener('click', () => selectDisc(disc));
        discsGrid.appendChild(discItem);
    });
}

// Выбор диска
function selectDisc(disc) {
    selectedDiscId = disc._id;
    selectedDiscName.textContent = `${disc.brand || 'Бренд'} ${disc.model_name || 'Модель'}`;
    selectedDisc.style.display = 'block';
    
    // Обновляем выделение
    document.querySelectorAll('.disc-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.discId === disc._id);
    });
    
    checkFormValidity();
    
    // Прокручиваем к выбранному диску
    selectedDisc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Обновление пагинации
function updatePagination(pag) {
    if (pag.pages > 1) {
        pagination.style.display = 'flex';
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= pag.pages;
        pageInfo.textContent = `Страница ${pag.page} из ${pag.pages} (всего: ${pag.total})`;
    } else {
        pagination.style.display = 'none';
    }
}

// Обработка клика по области загрузки
uploadArea.addEventListener('click', () => {
    imageInput.click();
});

// Обработка выбора файла
imageInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
});

// Обработка перетаскивания файла
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFile(file);
    }
});

// Обработка файла
function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showError('Пожалуйста, выберите изображение');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showError('Размер файла не должен превышать 10MB');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        selectedImageBase64 = e.target.result;
        previewImg.src = selectedImageBase64;
        imagePreview.style.display = 'block';
        uploadArea.style.display = 'none';
        checkFormValidity();
    };
    reader.readAsDataURL(file);
}

// Удаление изображения
removeImageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedImageBase64 = null;
    imageInput.value = '';
    imagePreview.style.display = 'none';
    uploadArea.style.display = 'block';
    checkFormValidity();
});

// Проверка валидности формы
function checkFormValidity() {
    const isValid = selectedImageBase64 && selectedDiscId;
    processBtn.disabled = !isValid;
}

// Обработка отправки формы
processBtn.addEventListener('click', async () => {
    if (!selectedImageBase64 || !selectedDiscId) {
        showError('Пожалуйста, загрузите изображение и выберите диск');
        return;
    }

    // Показываем индикатор загрузки
    processBtn.disabled = true;
    const btnText = processBtn.querySelector('.btn-text');
    const btnLoader = processBtn.querySelector('.btn-loader');
    btnText.textContent = 'Обработка...';
    btnLoader.style.display = 'inline-block';
    hideError();
    resultSection.style.display = 'none';

    try {
        const response = await fetch('/api/fitment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                discId: selectedDiscId,
                carImageBase64: selectedImageBase64
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Произошла ошибка при обработке запроса');
        }

        // Показываем результат
        displayResult(data);

    } catch (error) {
        showError(error.message || 'Произошла ошибка при отправке запроса');
    } finally {
        // Восстанавливаем кнопку
        processBtn.disabled = false;
        btnText.textContent = 'Применить виртуальную примерку';
        btnLoader.style.display = 'none';
        checkFormValidity();
    }
});

// Улучшенное отображение результата
function displayResult(data) {
    const discDetails = data.disc_details || {};
    
    let resultHTML = '';
    
    // Предпросмотр изображения (если есть)
    if (data.resultImageBase64) {
        resultHTML += `
            <div class="result-image-preview">
                <img src="data:image/jpeg;base64,${data.resultImageBase64}" alt="Результат виртуальной примерки">
            </div>
        `;
    } else {
        // Показываем оригинальное изображение, если результат еще не готов
        resultHTML += `
            <div class="result-image-preview">
                <img src="${selectedImageBase64}" alt="Загруженное изображение">
                <div style="text-align: center; padding: 1rem; color: var(--text-secondary);">
                    Ожидание обработки AI...
                </div>
            </div>
        `;
    }
    
    // Информация о диске
    resultHTML += `
        <div class="result-info-grid">
            ${discDetails.brand ? `
                <div class="result-spec-item">
                    <div class="result-spec-label">Бренд</div>
                    <div class="result-spec-value">${discDetails.brand}</div>
                </div>
            ` : ''}
            ${discDetails.model ? `
                <div class="result-spec-item">
                    <div class="result-spec-label">Модель</div>
                    <div class="result-spec-value">${discDetails.model}</div>
                </div>
            ` : ''}
            ${discDetails.diameter ? `
                <div class="result-spec-item">
                    <div class="result-spec-label">Диаметр</div>
                    <div class="result-spec-value">${discDetails.diameter}"</div>
                </div>
            ` : ''}
            ${discDetails.width ? `
                <div class="result-spec-item">
                    <div class="result-spec-label">Ширина</div>
                    <div class="result-spec-value">${discDetails.width}J</div>
                </div>
            ` : ''}
            ${discDetails.pcd ? `
                <div class="result-spec-item">
                    <div class="result-spec-label">PCD</div>
                    <div class="result-spec-value">${discDetails.pcd}</div>
                </div>
            ` : ''}
            ${discDetails.et !== undefined ? `
                <div class="result-spec-item">
                    <div class="result-spec-label">Вылет (ET)</div>
                    <div class="result-spec-value">${discDetails.et}</div>
                </div>
            ` : ''}
            ${discDetails.center_bore ? `
                <div class="result-spec-item">
                    <div class="result-spec-label">Центральное отверстие</div>
                    <div class="result-spec-value">${discDetails.center_bore}</div>
                </div>
            ` : ''}
        </div>
    `;
    
    // Статус и дополнительная информация
    if (data.image_optimized) {
        const savedKB = ((data.original_size - data.optimized_size) / 1024).toFixed(1);
        resultHTML += `
            <div class="result-item">
                <strong>Статус:</strong> ${data.message || data.status || 'Успешно'}<br>
                <small style="color: var(--text-secondary);">
                    Изображение оптимизировано (сэкономлено: ${savedKB} KB)
                </small>
            </div>
        `;
    }
    
    if (data.ai_prompt_generated) {
        resultHTML += `
            <div class="result-item">
                <strong>Сгенерированный промпт для AI:</strong><br>
                <em style="color: var(--text-secondary);">${data.ai_prompt_generated}</em>
            </div>
        `;
    }
    
    resultContent.innerHTML = resultHTML;
    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Показ ошибки
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Скрытие ошибки
function hideError() {
    errorMessage.style.display = 'none';
}
