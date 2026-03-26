from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

sync_engine = create_engine(settings.database_url_sync, echo=False)
SyncSessionLocal = sessionmaker(bind=sync_engine, class_=Session)
