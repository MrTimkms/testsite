// Элементы DOM
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImage');
const discIdInput = document.getElementById('discId');
const processBtn = document.getElementById('processBtn');
const resultSection = document.getElementById('resultSection');
const resultContent = document.getElementById('resultContent');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

let selectedImageBase64 = null;

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
removeImageBtn.addEventListener('click', () => {
    selectedImageBase64 = null;
    imageInput.value = '';
    imagePreview.style.display = 'none';
    uploadArea.style.display = 'block';
    checkFormValidity();
});

// Проверка валидности формы
function checkFormValidity() {
    const isValid = selectedImageBase64 && discIdInput.value.trim() !== '';
    processBtn.disabled = !isValid;
}

discIdInput.addEventListener('input', checkFormValidity);

// Обработка отправки формы
processBtn.addEventListener('click', async () => {
    if (!selectedImageBase64 || !discIdInput.value.trim()) {
        showError('Пожалуйста, загрузите изображение и введите ID диска');
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
                discId: discIdInput.value.trim(),
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

// Отображение результата
function displayResult(data) {
    resultContent.innerHTML = `
        <div class="result-item">
            <strong>Статус:</strong> ${data.status || 'Успешно'}
        </div>
        ${data.disc_details ? `
            <div class="result-item">
                <strong>Бренд:</strong> ${data.disc_details.brand || 'Не указан'}<br>
                <strong>Модель:</strong> ${data.disc_details.model || 'Не указана'}
            </div>
        ` : ''}
        ${data.ai_prompt_generated ? `
            <div class="result-item">
                <strong>Сгенерированный промпт для AI:</strong><br>
                <em>${data.ai_prompt_generated}</em>
            </div>
        ` : ''}
    `;
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

