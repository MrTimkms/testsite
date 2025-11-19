import os
import json
import base64
import re
from io import BytesIO
from typing import Tuple, Optional
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
from PIL import Image
import hashlib

# Загружаем переменные окружения из файла .env (например, для API-ключей)
load_dotenv()

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для API запросов

# --- Конфигурация MongoDB ---
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'wheel_finder_db')

# Ограничения
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

try:
    client = MongoClient(MONGO_URI)
    db = client[DATABASE_NAME]
    discs_collection = db["discs"]
    print("✅ Успешное подключение к MongoDB!")
except Exception as e:
    print(f"❌ Ошибка подключения к MongoDB: {e}")
    # Желательно тут прервать запуск сервера, если нет подключения


# -----------------------------

# --- Вспомогательные функции ---

def validate_image_base64(image_base64: str) -> Tuple[bool, str, Optional[bytes]]:
    """Валидация и обработка Base64 изображения."""
    if not image_base64:
        return False, "Изображение не предоставлено", None
    
    # Проверка формата Base64
    if not image_base64.startswith('data:image'):
        return False, "Неверный формат изображения", None
    
    try:
        # Извлекаем данные изображения
        header, encoded = image_base64.split(',', 1)
        
        # Проверяем тип файла
        if not any(ext in header.lower() for ext in ALLOWED_EXTENSIONS):
            return False, f"Разрешены только форматы: {', '.join(ALLOWED_EXTENSIONS)}", None
        
        # Декодируем Base64
        image_data = base64.b64decode(encoded)
        
        # Проверяем размер
        if len(image_data) > MAX_FILE_SIZE:
            return False, f"Размер файла превышает {MAX_FILE_SIZE / 1024 / 1024}MB", None
        
        # Валидация изображения через PIL
        try:
            img = Image.open(BytesIO(image_data))
            img.verify()
            return True, "OK", image_data
        except Exception as e:
            return False, f"Неверный формат изображения: {str(e)}", None
            
    except Exception as e:
        return False, f"Ошибка обработки изображения: {str(e)}", None


def optimize_image(image_data: bytes, max_size: tuple = (1920, 1080), quality: int = 85) -> bytes:
    """Оптимизация изображения для уменьшения размера."""
    try:
        img = Image.open(BytesIO(image_data))
        
        # Конвертируем RGBA в RGB если нужно
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        # Изменяем размер если нужно
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Сохраняем в буфер
        output = BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        return output.getvalue()
    except Exception as e:
        print(f"Ошибка оптимизации изображения: {e}")
        return image_data


@app.route('/')
def index():
    """Главная страница приложения."""
    return render_template('index.html')


@app.route('/api/discs', methods=['GET'])
def get_discs():
    """Получение списка дисков с фильтрацией."""
    try:
        # Параметры фильтрации
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        brand = request.args.get('brand', None)
        search = request.args.get('search', None)
        
        # Формируем запрос
        query = {}
        if brand:
            query['brand'] = {'$regex': brand, '$options': 'i'}
        if search:
            query['$or'] = [
                {'brand': {'$regex': search, '$options': 'i'}},
                {'model_name': {'$regex': search, '$options': 'i'}}
            ]
        
        # Получаем общее количество
        total = discs_collection.count_documents(query)
        
        # Получаем диски с пагинацией
        skip = (page - 1) * per_page
        discs = list(discs_collection.find(query).skip(skip).limit(per_page))
        
        # Преобразуем ObjectId в строку для JSON
        for disc in discs:
            disc['_id'] = str(disc['_id'])
        
        return jsonify({
            'discs': discs,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })
    except Exception as e:
        return jsonify({"error": f"Ошибка получения дисков: {str(e)}"}), 500


@app.route('/api/discs/brands', methods=['GET'])
def get_brands():
    """Получение списка уникальных брендов."""
    try:
        brands = discs_collection.distinct('brand')
        brands = sorted([b for b in brands if b])  # Убираем None и сортируем
        return jsonify({'brands': brands})
    except Exception as e:
        return jsonify({"error": f"Ошибка получения брендов: {str(e)}"}), 500


def generate_ai_prompt(disc_data: dict) -> str:
    """Генерирует финальный промпт для AI-модели на основе данных из MongoDB."""

    style_tag = disc_data.get('ai_style_tag', 'modern alloy')
    geometry_tag = disc_data.get('ai_geometry_tag', 'multi-spoke')

    # Формируем инструкцию для генеративной модели
    prompt = (
        f"Replace the existing wheel on the car image with a high-quality, "
        f"{style_tag} wheel, featuring {geometry_tag}. "
        f"Ensure realistic light, shadow, and ground reflections."
    )
    return prompt


@app.route('/api/fitment', methods=['POST'])
def fitment_api():
    """Эндпоинт для обработки запроса на виртуальную примерку."""

    # 1. Получаем данные от фронтенда (ID диска и Base64 изображения)
    data = request.json
    if not data:
        return jsonify({"error": "Данные не предоставлены"}), 400
        
    disc_id_str = data.get('discId')
    car_image_base64 = data.get('carImageBase64')

    if not disc_id_str or not car_image_base64:
        return jsonify({"error": "Требуются 'discId' и 'carImageBase64'."}), 400

    try:
        # 2. Валидация изображения
        is_valid, error_msg, image_data = validate_image_base64(car_image_base64)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        # 3. Оптимизация изображения
        optimized_image = optimize_image(image_data)
        optimized_base64 = base64.b64encode(optimized_image).decode('utf-8')
        
        # 4. Валидация ObjectId
        if not ObjectId.is_valid(disc_id_str):
            return jsonify({"error": f"Неверный формат ID диска: {disc_id_str}"}), 400
        
        # 5. Ищем диск в MongoDB по ID
        disc_id_obj = ObjectId(disc_id_str)
        disc_data = discs_collection.find_one({"_id": disc_id_obj})

        if not disc_data:
            return jsonify({"error": f"Диск с ID {disc_id_str} не найден."}), 404

        # 6. Генерируем промпт
        ai_prompt = generate_ai_prompt(disc_data)

        # --- Здесь будет вызов внешнего AI API ---
        # processed_image_base64 = call_ai_inpainting_api(optimized_base64, ai_prompt)

        # Для демонстрации пока просто возвращаем промпт и информацию о диске
        disc_data['_id'] = str(disc_data['_id'])
        
        return jsonify({
            "status": "success",
            "message": "Запрос готов к обработке AI",
            "disc_details": {
                "id": disc_data['_id'],
                "brand": disc_data.get('brand'),
                "model": disc_data.get('model_name'),
                "diameter": disc_data.get('diameter'),
                "width": disc_data.get('width'),
                "pcd": disc_data.get('pcd'),
                "et": disc_data.get('et'),
                "center_bore": disc_data.get('center_bore')
            },
            "ai_prompt_generated": ai_prompt,
            "image_optimized": True,
            "original_size": len(image_data),
            "optimized_size": len(optimized_image)
            # "resultImageBase64": processed_image_base64
        })

    except ValueError as e:
        return jsonify({"error": f"Ошибка валидации: {str(e)}"}), 400
    except Exception as e:
        # Обработка ошибок, включая неправильный формат ObjectId
        return jsonify({"error": f"Внутренняя ошибка сервера: {str(e)}"}), 500


if __name__ == '__main__':
    # Запуск сервера на порту 5000 (по умолчанию)
    print("🌐 Запуск Flask-сервера на http://127.0.0.1:5000/")
    app.run(debug=True, port=5000)