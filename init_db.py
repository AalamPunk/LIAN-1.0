from app import app, db
from models import User

with app.app_context():
    db.create_all()

    # Create test user (plain password)
    admin = User(username='admin', password='password123')
    db.session.add(admin)
    db.session.commit()
