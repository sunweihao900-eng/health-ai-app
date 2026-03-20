FROM python:3.11-slim

WORKDIR /app

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python依赖
# 云部署(Railway/Render)用 requirements-cloud.txt 节省内存，本地/Docker 用 requirements.txt
ARG REQUIREMENTS_FILE=requirements-cloud.txt
COPY requirements.txt requirements-cloud.txt ./
RUN pip install --no-cache-dir -r ${REQUIREMENTS_FILE}

# 应用代码
COPY . .

# 非root用户运行
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
