drop database if exists fashion_store;
create database if not exists fashion_store;
use fashion_store;
CREATE TABLE users (
                       user_id INT AUTO_INCREMENT PRIMARY KEY,
                       full_name VARCHAR(100) NOT NULL,
                       email VARCHAR(100) NOT NULL UNIQUE,
                       password_hash VARCHAR(255) NOT NULL,
                       phone VARCHAR(20),
                       address TEXT,
                       role ENUM('customer', 'admin', 'staff') DEFAULT 'customer',
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
                            category_id INT AUTO_INCREMENT PRIMARY KEY,
                            category_name VARCHAR(100) NOT NULL,
                            description TEXT
);

CREATE TABLE products (
                          product_id INT AUTO_INCREMENT PRIMARY KEY,
                          category_id INT NOT NULL,
                          name VARCHAR(200) NOT NULL,
                          description TEXT,
                          price DECIMAL(10,2) NOT NULL,
                          stock INT DEFAULT 0,
                          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                          FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE product_images (
                                image_id INT AUTO_INCREMENT PRIMARY KEY,
                                product_id INT NOT NULL,
                                image_url VARCHAR(255) NOT NULL,
                                is_main BOOLEAN DEFAULT FALSE,
                                FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE product_variants (
                                  variant_id INT AUTO_INCREMENT PRIMARY KEY,
                                  product_id INT NOT NULL,
                                  size VARCHAR(10),
                                  color VARCHAR(50),
                                  additional_price DECIMAL(10,2) DEFAULT 0,
                                  stock INT DEFAULT 0,
                                  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE orders (
                        order_id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        order_status ENUM('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
                        payment_status ENUM('unpaid','paid') DEFAULT 'unpaid',
                        total_amount DECIMAL(10,2) NOT NULL,
                        shipping_address TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE order_items (
                             order_item_id INT AUTO_INCREMENT PRIMARY KEY,
                             order_id INT NOT NULL,
                             product_id INT NOT NULL,
                             variant_id INT,
                             quantity INT NOT NULL,
                             price DECIMAL(10,2) NOT NULL,
                             FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
                             FOREIGN KEY (product_id) REFERENCES products(product_id),
                             FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id)
);

CREATE TABLE reviews (
                         review_id INT AUTO_INCREMENT PRIMARY KEY,
                         product_id INT NOT NULL,
                         user_id INT NOT NULL,
                         rating INT CHECK (rating BETWEEN 1 AND 5),
                         comment TEXT,
                         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                         FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
                         FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE cart (
                      cart_id INT AUTO_INCREMENT PRIMARY KEY,
                      user_id INT NOT NULL,
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE cart_items (
                            cart_item_id INT AUTO_INCREMENT PRIMARY KEY,
                            cart_id INT NOT NULL,
                            product_id INT NOT NULL,
                            variant_id INT,
                            quantity INT NOT NULL CHECK (quantity > 0),
                            price DECIMAL(10,2) NOT NULL, -- giá tại thời điểm thêm vào giỏ
                            FOREIGN KEY (cart_id) REFERENCES cart(cart_id) ON DELETE CASCADE,
                            FOREIGN KEY (product_id) REFERENCES products(product_id),
                            FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id)
);

CREATE TABLE product_comments (
                                  comment_id INT AUTO_INCREMENT PRIMARY KEY,
                                  product_id INT NOT NULL,
                                  user_id INT NOT NULL,
                                  parent_id INT DEFAULT NULL, -- nếu là câu trả lời thì lưu id của câu hỏi
                                  content TEXT NOT NULL,
                                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
                                  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                                  FOREIGN KEY (parent_id) REFERENCES product_comments(comment_id) ON DELETE CASCADE
);
