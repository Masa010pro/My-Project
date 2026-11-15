from flask import render_template, redirect, url_for, request, flash, send_from_directory, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.utils import secure_filename
from app import app, db
from app.models import User, Category, Product, CartItem, Order, OrderItem, Message
import os
from datetime import datetime

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.context_processor
def inject_categories():
    return dict(Category=Category)

@app.route('/')
def index():
    products = Product.query.order_by(Product.created_at.desc()).limit(12).all()
    categories = Category.query.all()
    return render_template('index.html', products=products, categories=categories)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        is_seller = request.form.get('is_seller') == 'on'
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'danger')
            return redirect(url_for('register'))
        
        if User.query.filter_by(email=email).first():
            flash('Email already exists', 'danger')
            return redirect(url_for('register'))
        
        user = User(username=username, email=email, is_seller=is_seller)
        user.set_password(password)
        
        if User.query.count() == 0:
            user.is_admin = True
        
        db.session.add(user)
        db.session.commit()
        flash('Registration successful! Please login.', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('index'))
        else:
            flash('Invalid username or password', 'danger')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/product/<int:product_id>')
def product_detail(product_id):
    product = Product.query.get_or_404(product_id)
    return render_template('product.html', product=product)

@app.route('/category/<int:category_id>')
def category_products(category_id):
    category = Category.query.get_or_404(category_id)
    products = Product.query.filter_by(category_id=category_id).all()
    return render_template('category.html', category=category, products=products)

@app.route('/add_to_cart/<int:product_id>', methods=['POST'])
@login_required
def add_to_cart(product_id):
    product = Product.query.get_or_404(product_id)
    quantity = int(request.form.get('quantity', 1))
    
    cart_item = CartItem.query.filter_by(user_id=current_user.id, product_id=product_id).first()
    
    if cart_item:
        cart_item.quantity += quantity
    else:
        cart_item = CartItem(user_id=current_user.id, product_id=product_id, quantity=quantity)
        db.session.add(cart_item)
    
    db.session.commit()
    flash(f'Added {quantity} x {product.name} to cart', 'success')
    return redirect(url_for('cart'))

@app.route('/cart')
@login_required
def cart():
    cart_items = CartItem.query.filter_by(user_id=current_user.id).all()
    total = sum(item.product.price * item.quantity for item in cart_items)
    return render_template('cart.html', cart_items=cart_items, total=total)

@app.route('/update_cart/<int:cart_item_id>', methods=['POST'])
@login_required
def update_cart(cart_item_id):
    cart_item = CartItem.query.get_or_404(cart_item_id)
    if cart_item.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    quantity = int(request.form.get('quantity', 1))
    if quantity <= 0:
        db.session.delete(cart_item)
    else:
        cart_item.quantity = quantity
    
    db.session.commit()
    return redirect(url_for('cart'))

@app.route('/remove_cart/<int:cart_item_id>')
@login_required
def remove_cart(cart_item_id):
    cart_item = CartItem.query.get_or_404(cart_item_id)
    if cart_item.user_id == current_user.id:
        db.session.delete(cart_item)
        db.session.commit()
        flash('Item removed from cart', 'success')
    return redirect(url_for('cart'))

@app.route('/checkout', methods=['GET', 'POST'])
@login_required
def checkout():
    cart_items = CartItem.query.filter_by(user_id=current_user.id).all()
    
    if not cart_items:
        flash('Your cart is empty', 'warning')
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        total = sum(item.product.price * item.quantity for item in cart_items)
        
        order = Order(user_id=current_user.id, total_amount=total, status='pending')
        db.session.add(order)
        db.session.flush()
        
        for item in cart_items:
            if item.product.stock < item.quantity:
                flash(f'Insufficient stock for {item.product.name}', 'danger')
                return redirect(url_for('cart'))
            
            order_item = OrderItem(
                order_id=order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                price=item.product.price
            )
            item.product.stock -= item.quantity
            db.session.add(order_item)
        
        for item in cart_items:
            db.session.delete(item)
        
        db.session.commit()
        flash('Order placed successfully!', 'success')
        return redirect(url_for('orders'))
    
    total = sum(item.product.price * item.quantity for item in cart_items)
    return render_template('checkout.html', cart_items=cart_items, total=total)

@app.route('/orders')
@login_required
def orders():
    user_orders = Order.query.filter_by(user_id=current_user.id).order_by(Order.created_at.desc()).all()
    return render_template('orders.html', orders=user_orders)

@app.route('/order/<int:order_id>')
@login_required
def order_detail(order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != current_user.id and not current_user.is_admin:
        flash('Unauthorized', 'danger')
        return redirect(url_for('index'))
    return render_template('order_detail.html', order=order)

@app.route('/seller/products')
@login_required
def seller_products():
    if not current_user.is_seller and not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    products = Product.query.filter_by(seller_id=current_user.id).all()
    return render_template('seller_products.html', products=products)

@app.route('/seller/add_product', methods=['GET', 'POST'])
@login_required
def seller_add_product():
    if not current_user.is_seller and not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    categories = Category.query.all()
    
    if request.method == 'POST':
        name = request.form.get('name')
        description = request.form.get('description')
        price = float(request.form.get('price'))
        stock = int(request.form.get('stock'))
        category_id = int(request.form.get('category_id'))
        
        image = 'default.jpg'
        if 'image' in request.files:
            file = request.files['image']
            if file and allowed_file(file.filename):
                filename = secure_filename(f"{datetime.now().timestamp()}_{file.filename}")
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                image = filename
        
        product = Product(
            name=name,
            description=description,
            price=price,
            stock=stock,
            category_id=category_id,
            seller_id=current_user.id,
            image=image
        )
        
        db.session.add(product)
        db.session.commit()
        flash('Product added successfully!', 'success')
        return redirect(url_for('seller_products'))
    
    return render_template('seller_add_product.html', categories=categories)

@app.route('/seller/edit_product/<int:product_id>', methods=['GET', 'POST'])
@login_required
def seller_edit_product(product_id):
    if not current_user.is_seller and not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    product = Product.query.get_or_404(product_id)
    if product.seller_id != current_user.id and not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    categories = Category.query.all()
    
    if request.method == 'POST':
        product.name = request.form.get('name')
        product.description = request.form.get('description')
        product.price = float(request.form.get('price'))
        product.stock = int(request.form.get('stock'))
        product.category_id = int(request.form.get('category_id'))
        
        if 'image' in request.files:
            file = request.files['image']
            if file and allowed_file(file.filename):
                filename = secure_filename(f"{datetime.now().timestamp()}_{file.filename}")
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                product.image = filename
        
        db.session.commit()
        flash('Product updated successfully!', 'success')
        return redirect(url_for('seller_products'))
    
    return render_template('seller_edit_product.html', product=product, categories=categories)

@app.route('/seller/delete_product/<int:product_id>')
@login_required
def seller_delete_product(product_id):
    if not current_user.is_seller and not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    product = Product.query.get_or_404(product_id)
    if product.seller_id != current_user.id and not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    db.session.delete(product)
    db.session.commit()
    flash('Product deleted', 'success')
    return redirect(url_for('seller_products'))

@app.route('/seller/orders')
@login_required
def seller_orders():
    if not current_user.is_seller and not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    seller_products = Product.query.filter_by(seller_id=current_user.id).all()
    seller_product_ids = [p.id for p in seller_products]
    
    order_items = OrderItem.query.filter(OrderItem.product_id.in_(seller_product_ids)).all()
    order_ids = list(set([item.order_id for item in order_items]))
    orders = Order.query.filter(Order.id.in_(order_ids)).all()
    
    return render_template('seller_orders.html', orders=orders)

@app.route('/seller/update_order/<int:order_id>', methods=['POST'])
@login_required
def seller_update_order(order_id):
    if not current_user.is_seller and not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    order = Order.query.get_or_404(order_id)
    status = request.form.get('status')
    
    order.status = status
    db.session.commit()
    flash(f'Order #{order.id} updated to {status}', 'success')
    return redirect(url_for('seller_orders'))

@app.route('/admin/categories', methods=['GET', 'POST'])
@login_required
def admin_categories():
    if not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        name = request.form.get('name')
        description = request.form.get('description')
        
        if Category.query.filter_by(name=name).first():
            flash('Category already exists', 'danger')
        else:
            category = Category(name=name, description=description)
            db.session.add(category)
            db.session.commit()
            flash('Category added', 'success')
    
    categories = Category.query.all()
    return render_template('admin_categories.html', categories=categories)

@app.route('/admin/delete_category/<int:category_id>')
@login_required
def admin_delete_category(category_id):
    if not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    category = Category.query.get_or_404(category_id)
    db.session.delete(category)
    db.session.commit()
    flash('Category deleted', 'success')
    return redirect(url_for('admin_categories'))

@app.route('/admin/users')
@login_required
def admin_users():
    if not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    users = User.query.all()
    return render_template('admin_users.html', users=users)

@app.route('/admin/toggle_seller/<int:user_id>')
@login_required
def admin_toggle_seller(user_id):
    if not current_user.is_admin:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    user = User.query.get_or_404(user_id)
    user.is_seller = not user.is_seller
    db.session.commit()
    flash(f'Seller status toggled for {user.username}', 'success')
    return redirect(url_for('admin_users'))

@app.route('/messages')
@login_required
def messages():
    received = Message.query.filter_by(recipient_id=current_user.id).order_by(Message.created_at.desc()).all()
    sent = Message.query.filter_by(sender_id=current_user.id).order_by(Message.created_at.desc()).all()
    users = User.query.filter(User.id != current_user.id).all()
    return render_template('messages.html', received=received, sent=sent, users=users)

@app.route('/send_message', methods=['POST'])
@login_required
def send_message():
    recipient_id = int(request.form.get('recipient_id'))
    subject = request.form.get('subject')
    content = request.form.get('content')
    
    message = Message(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        subject=subject,
        content=content
    )
    
    db.session.add(message)
    db.session.commit()
    flash('Message sent!', 'success')
    return redirect(url_for('messages'))

@app.route('/read_message/<int:message_id>')
@login_required
def read_message(message_id):
    message = Message.query.get_or_404(message_id)
    if message.recipient_id != current_user.id and message.sender_id != current_user.id:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    if message.recipient_id == current_user.id and not message.is_read:
        message.is_read = True
        db.session.commit()
    
    return render_template('read_message.html', message=message)

@app.route('/delete_message/<int:message_id>')
@login_required
def delete_message(message_id):
    message = Message.query.get_or_404(message_id)
    if message.recipient_id != current_user.id and message.sender_id != current_user.id:
        flash('Access denied', 'danger')
        return redirect(url_for('index'))
    
    db.session.delete(message)
    db.session.commit()
    flash('Message deleted', 'success')
    return redirect(url_for('messages'))

@app.route('/search')
def search():
    query = request.args.get('q', '')
    products = Product.query.filter(Product.name.ilike(f'%{query}%')).limit(20).all()
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'price': p.price,
        'image': p.image
    } for p in products])

@app.route('/uploads/')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.context_processor
def cart_count():
    if current_user.is_authenticated:
        count = CartItem.query.filter_by(user_id=current_user.id).count()
        unread = Message.query.filter_by(recipient_id=current_user.id, is_read=False).count()
    else:
        count = 0
        unread = 0
    return dict(cart_count=count, unread_messages=unread)