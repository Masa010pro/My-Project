import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import Flask app directly from app module
from app import app, db
from app.models import User, Category

def init_db():
    # Create tables
    db.create_all()
    
    # Create default categories
    categories = [
        Category(name='Electronics', description='Electronic devices and gadgets'),
        Category(name='Clothing', description='Fashion and apparel'),
        Category(name='Books', description='Books and publications'),
        Category(name='Home & Garden', description='Home improvement and gardening'),
        Category(name='Sports', description='Sports equipment and accessories'),
        Category(name='Food', description='Food and beverages')
    ]
    
    for cat in categories:
        if not Category.query.filter_by(name=cat.name).first():
            db.session.add(cat)
    
    db.session.commit()
    
    # Create default admin if not exists
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', email='admin@lancommerce.local', is_admin=True, is_seller=True)
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        print("Admin user created: admin / admin123")

if __name__ == '__main__':
    with app.app_context():
        init_db()
    
    # Get host IP for LAN access
    import socket
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    print(f"\n{'='*50}")
    print(f"LAN E-Commerce System Starting...")
    print(f"Access at: http://localhost:5000")
    print(f"LAN Access: http://{local_ip}:5000")
    print(f"{'='*50}\n")
    app.run(host='0.0.0.0', port=5000, debug=True)