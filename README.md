# LAN E-Commerce System

A complete offline LAN-based e-commerce web system built with Flask.

## Features

- **User Management**: Registration, login, role-based access (Admin, Seller, Buyer)
- **Product Management**: Add, edit, delete products with image upload
- **Categories**: Organize products by categories (admin-managed)
- **Shopping Cart**: Add products, update quantities, remove items
- **Order System**: Place orders, track order status
- **Seller Dashboard**: Manage products, view and update orders
- **Admin Dashboard**: Manage categories and users
- **Messaging System**: Send messages between users
- **Search**: Real-time product search

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the Application

```bash
python run.py
```

### 3. Access the Application

- **Local**: http://localhost:5000
- **LAN**: http://YOUR_IP_ADDRESS:5000

### 4. Default Admin Account

- Username: `admin`
- Password: `admin123`

## Folder Structure

```
lan_ecommerce/
├── app/
│   ├── __init__.py         # Flask app initialization
│   ├── models.py           # Database models
│   ├── routes.py           # Application routes
│   ├── templates/          # HTML templates
│   │   ├── base.html
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── product.html
│   │   ├── category.html
│   │   ├── cart.html
│   │   ├── checkout.html
│   │   ├── orders.html
│   │   ├── order_detail.html
│   │   ├── seller_products.html
│   │   ├── seller_add_product.html
│   │   ├── seller_edit_product.html
│   │   ├── seller_orders.html
│   │   ├── admin_categories.html
│   │   ├── admin_users.html
│   │   ├── messages.html
│   │   └── read_message.html
│   └── static/
│       ├── css/
│       │   └── style.css
│       ├── js/
│       │   └── main.js
│       ├── images/
│       │   └── default.jpg
│       └── uploads/       # Product images directory
├── run.py                 # Application entry point
├── requirements.txt       # Python dependencies
└── README.md             # This file
```

## How to Use

### For Buyers

1. Register a new account
2. Browse products on the homepage
3. Click on a product to view details
4. Add products to cart
5. Proceed to checkout
6. View order history

### For Sellers

1. Register and check "Register as Seller" (or ask admin to enable)
2. Go to Seller Panel → Add Product
3. Fill in product details and upload an image
4. Manage your products from Seller Panel → My Products
5. View and update order statuses

### For Admins

1. Login with admin account (default: admin/admin123)
2. Access Admin panel from the navbar
3. Manage categories and users
4. Toggle seller status for users

## Network Access

To make this accessible on your LAN:

1. Run `python run.py`
2. The application will show your local IP address
3. Other devices on the same network can access via http://YOUR_IP:5000
4. All devices will share the same SQLite database

## Technology Stack

- **Backend**: Flask (Python)
- **Database**: SQLite (SQLAlchemy)
- **Authentication**: Flask-Login
- **Password Hashing**: Flask-Bcrypt
- **Frontend**: Bootstrap 5, Custom CSS, Vanilla JavaScript

## Database

The SQLite database (`ecommerce.db`) is created automatically on first run.

## Security Notes

- Change the SECRET_KEY in `app/__init__.py` for production
- This is for LAN/offline use - not intended for internet exposure
- User passwords are hashed using bcrypt
