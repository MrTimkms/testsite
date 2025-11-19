import os
import json
from flask import Flask, request, jsonify, render_template
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv

# Загружаем переменные окружения из файла .env (например, для API-ключей)
load_dotenv()

app = Flask(__name__)

# --- Конфигурация MongoDB ---
# URI должен соответствовать вашему локальному серверу
MONGO_URI = "mongodb://localhost:27017/"
DATABASE_NAME = "wheel_finder_db"

try:
    client = MongoClient(MONGO_URI)
    db = client[DATABASE_NAME]
    discs_collection = db["discs"]
    print("✅ Успешное подключение к MongoDB!")
except Exception as e:
    print(f"❌ Ошибка подключения к MongoDB: {e}")
    # Желательно тут прервать запуск сервера, если нет подключения


# -----------------------------

@app.route('/')
def index():
    """Главная страница приложения."""
    return render_template('index.html')


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
    disc_id_str = data.get('discId')
    car_image_base64 = data.get('carImageBase64')  # Изображение пользователя

    if not disc_id_str or not car_image_base64:
        return jsonify({"error": "Требуются 'discId' и 'carImageBase64'."}), 400

    try:
        # 2. Ищем диск в MongoDB по ID
        disc_id_obj = ObjectId(disc_id_str)
        disc_data = discs_collection.find_one({"_id": disc_id_obj})

        if not disc_data:
            return jsonify({"error": f"Диск с ID {disc_id_str} не найден."}), 404

        # 3. Генерируем промпт
        ai_prompt = generate_ai_prompt(disc_data)

        # --- Здесь будет вызов внешнего AI API ---

        # 4. (Следующий шаг) Вызов функции, которая отправит запрос на AI API
        # processed_image_base64 = call_ai_inpainting_api(car_image_base64, ai_prompt)

        # Для демонстрации пока просто возвращаем промпт
        return jsonify({
            "status": "Ready for AI",
            "disc_details": {
                "brand": disc_data.get('brand'),
                "model": disc_data.get('model_name'),
            },
            "ai_prompt_generated": ai_prompt,
            # "resultImageBase64": processed_image_base64
        })

    except Exception as e:
        # Обработка ошибок, включая неправильный формат ObjectId
        return jsonify({"error": f"Внутренняя ошибка сервера: {str(e)}"}), 500


if __name__ == '__main__':
    # Запуск сервера на порту 5000 (по умолчанию)
    print("🌐 Запуск Flask-сервера на http://127.0.0.1:5000/")
    app.run(debug=True, port=5000)