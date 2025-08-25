IF DB_ID('fashion_store') IS NOT NULL
DROP DATABASE fashion_store;
GO

CREATE DATABASE fashion_store;
GO
USE fashion_store;
GO

CREATE TABLE users
(
    user_id       INT IDENTITY (1,1) PRIMARY KEY,
    full_name     NVARCHAR(100),
    email         NVARCHAR(100) UNIQUE,
    password_hash NVARCHAR(255),
    phone         NVARCHAR(20),
    address       NVARCHAR(MAX),
    status        NVARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'banned')),
    role          NVARCHAR(20) DEFAULT 'customer'
        CHECK (role IN ('customer', 'admin')),
    created_at    DATETIME     DEFAULT GETDATE()
);

CREATE TABLE categories
(
    category_id   INT IDENTITY (1,1) PRIMARY KEY,
    category_name NVARCHAR(100),
    description   NVARCHAR(MAX),
    status        NVARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at    DATETIME     DEFAULT GETDATE(),
    updated_at    DATETIME     DEFAULT GETDATE()
);

CREATE TABLE products
(
    product_id  INT IDENTITY (1,1) PRIMARY KEY,
    category_id INT,
    name        NVARCHAR(200),
    description NVARCHAR(MAX),
    price       DECIMAL(10, 2) DEFAULT 0,
    stock       INT            DEFAULT 0,
    status      NVARCHAR(20)   DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at  DATETIME       DEFAULT GETDATE(),
    updated_at  DATETIME       DEFAULT GETDATE(),
    FOREIGN KEY (category_id) REFERENCES categories (category_id)
);

CREATE TABLE product_images
(
    image_id   INT IDENTITY (1,1) PRIMARY KEY,
    product_id INT           NOT NULL,
    image_url  NVARCHAR(255) NOT NULL,
    is_main    BIT DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products (product_id) ON DELETE CASCADE
);

CREATE TABLE product_variants
(
    variant_id       INT IDENTITY (1,1) PRIMARY KEY,
    product_id       INT,
    size             NVARCHAR(10),
    color            NVARCHAR(50),
    additional_price DECIMAL(10, 2) DEFAULT 0,
    stock            INT            DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products (product_id) ON DELETE CASCADE
);

CREATE TABLE orders
(
    order_id         INT IDENTITY (1,1) PRIMARY KEY,
    user_id          INT,
    order_status     NVARCHAR(20) DEFAULT 'pending'
        CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    payment_status   NVARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
    total_amount     DECIMAL(10, 2),
    shipping_address NVARCHAR(MAX),
    created_at       DATETIME     DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users (user_id)
);

CREATE TABLE order_items
(
    order_item_id INT IDENTITY (1,1) PRIMARY KEY,
    order_id      INT,
    product_id    INT,
    variant_id    INT,
    quantity      INT,
    price         DECIMAL(10, 2),
    FOREIGN KEY (order_id) REFERENCES orders (order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products (product_id),
    FOREIGN KEY (variant_id) REFERENCES product_variants (variant_id)
);

CREATE TABLE reviews
(
    review_id  INT IDENTITY (1,1) PRIMARY KEY,
    product_id INT,
    user_id    INT,
    rating     INT CHECK (rating BETWEEN 1 AND 5),
    comment    NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (product_id) REFERENCES products (product_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE cart
(
    cart_id    INT IDENTITY (1,1) PRIMARY KEY,
    user_id    INT,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE cart_items
(
    cart_item_id INT IDENTITY (1,1) PRIMARY KEY,
    cart_id      INT,
    product_id   INT,
    variant_id   INT,
    quantity     INT CHECK (quantity > 0),
    price        DECIMAL(10, 2),
    FOREIGN KEY (cart_id) REFERENCES cart (cart_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products (product_id),
    FOREIGN KEY (variant_id) REFERENCES product_variants (variant_id)
);

CREATE TABLE product_comments
(
    comment_id INT IDENTITY (1,1) PRIMARY KEY,
    product_id INT,
    user_id    INT,
    parent_id  INT,
    content    NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (product_id) REFERENCES products (product_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES product_comments (comment_id) ON DELETE CASCADE
);
