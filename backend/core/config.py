from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    JWT_SECRET: str = "dev-secret-key-change-in-production"
    DATABASE_URL: str = "sqlite:///./planta.db"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 525960  # 1 year

    class Config:
        env_file = ".env"


settings = Settings()
