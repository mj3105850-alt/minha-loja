require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// ==========================================
// VARIÁVEIS DE AMBIENTE
// ==========================================

const CAIXA_API_URL = 'https://api.caixa.gov.br';
const CAIXA_MERCHANT_ID = process.env.CAIXA_MERCHANT_ID;
const CAIXA_ACCESS_TOKEN = process.env.CAIXA_ACCESS_TOKEN;
const CAIXA_ACCOUNT_ID = process.env.CAIXA_ACCOUNT_ID;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte';

const PORT = process.env.PORT || 3000;

// ==========================================
// CAMINHOS DE ARQUIVOS
// ==========================================

const productsFile = path.join(__dirname, 'products.json');
const ordersFile = path.join(__dirname, 'orders.json');

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function getProducts() {
  try {
    const data = fs.readFileSync(productsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler produtos:', error);
    return [];
  }
}

function saveProducts(products) {
  try {
    fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
  } catch (error) {
    console.error('Erro ao salvar produtos:', error);
  }
}

function getOrders() {
  try {
    if (!fs.existsSync(ordersFile)) {
      fs.writeFileSync(ordersFile, JSON.stringify([], null, 2));
    }
    const data = fs.readFileSync(ordersFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler pedidos:', error);
    return [];
  }
}

function saveOrders(orders) {
  try {
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
  } catch (error) {
    console.error('Erro ao salvar pedidos:', error);
  }
}

function generateOrderId() {
  return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// ==========================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ==========================================

function authenticateAdmin(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// ==========================================
// ROTAS PÚBLICAS - LOJA
// ==========================================

app.get('/api/products', (req, res) => {
  const products = getProducts();
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const products = getProducts();
  const product = products.find(p => p.id === parseInt(req.params.id));

  if (!product) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  res.json(product);
});

app.post('/api/orders', async (req, res) => {
  try {
    const { items, customer } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Carrinho vazio' });
    }

    const products = getProducts();
    for (const item of items) {
      const product = products.find(p => p.id === item.id);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({ error: `Estoque insuficiente: ${product?.name}` });
      }
    }

    let total = 0;
    for (const item of items) {
      const product = products.find(p => p.id === item.id);
      total += product.price * item.quantity;
    }

    const orderId = generateOrderId();
    const order = {
      id: orderId,
      items,
      customer,
      total,
      status: 'aguardando_pagamento',
      pixQrCode: null,
      pixCopyPaste: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // ==========================================
    // INTEGRAÇÃO COM CAIXA PIX
    // ==========================================

    try {
      const pixResponse = await axios.post(
        `${CAIXA_API_URL}/pix/qrcode`,
        {
          merchantId: CAIXA_MERCHANT_ID,
          transactionId: orderId,
          amount: (total * 100).toFixed(0),
          description: `Pedido ${orderId}`,
          returnUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/order/${orderId}`
        },
        {
          headers: {
            'Authorization': `Bearer ${CAIXA_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (pixResponse.data && pixResponse.data.qrCode) {
        order.pixQrCode = pixResponse.data.qrCode;
        order.pixCopyPaste = pixResponse.data.copyPaste || pixResponse.data.brCode;
        order.pixTransactionId = pixResponse.data.transactionId;
      }
    } catch (error) {
      console.error('Erro ao gerar QR Code Pix:', error.message);
      order.pixError = error.message;
    }

    const orders = getOrders();
    orders.push(order);
    saveOrders(orders);

    for (const item of items) {
      const product = products.find(p => p.id === item.id);
      if (product) {
        product.stock -= item.quantity;
      }
    }
    saveProducts(products);

    res.status(201).json(order);
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ error: 'Erro ao criar pedido' });
  }
});

app.get('/api/orders/:id', (req, res) => {
  const orders = getOrders();
  const order = orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }

  res.json(order);
});

// ==========================================
// WEBHOOK - CAIXA CONFIRMAR PAGAMENTO
// ==========================================

app.post('/webhook/payment', (req, res) => {
  try {
    const { transactionId, status, amount } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId obrigatório' });
    }

    const orders = getOrders();
    const order = orders.find(o => o.id === transactionId);

    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    if (status === 'completed' || status === 'paid') {
      order.status = 'pago';
      order.paidAt = new Date().toISOString();
    } else if (status === 'cancelled') {
      order.status = 'cancelado';
    }

    order.updatedAt = new Date().toISOString();
    saveOrders(orders);

    res.json({ success: true, message: 'Pagamento confirmado' });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
});

// ==========================================
// ROTAS ADMIN - AUTENTICAÇÃO
// ==========================================

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, message: 'Login realizado com sucesso' });
});

// ==========================================
// ROTAS ADMIN - PRODUTOS
// ==========================================

app.post('/api/admin/products', authenticateAdmin, (req, res) => {
  try {
    const { name, genre, price, rating, stock, image, description } = req.body;

    const products = getProducts();
    const newId = Math.max(...products.map(p => p.id), 0) + 1;

    const newProduct = {
      id: newId,
      name,
      genre,
      price: parseFloat(price),
      rating: parseInt(rating),
      stock: parseInt(stock),
      image,
      description
    };

    products.push(newProduct);
    saveProducts(products);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

app.put('/api/admin/products/:id', authenticateAdmin, (req, res) => {
  try {
    const { name, genre, price, rating, stock, image, description } = req.body;
    const products = getProducts();
    const product = products.find(p => p.id === parseInt(req.params.id));

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    if (name !== undefined) product.name = name;
    if (genre !== undefined) product.genre = genre;
    if (price !== undefined) product.price = parseFloat(price);
    if (rating !== undefined) product.rating = parseInt(rating);
    if (stock !== undefined) product.stock = parseInt(stock);
    if (image !== undefined) product.image = image;
    if (description !== undefined) product.description = description;

    saveProducts(products);
    res.json(product);
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

app.delete('/api/admin/products/:id', authenticateAdmin, (req, res) => {
  try {
    const products = getProducts();
    const index = products.findIndex(p => p.id === parseInt(req.params.id));

    if (index === -1) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    products.splice(index, 1);
    saveProducts(products);

    res.json({ message: 'Produto deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({ error: 'Erro ao deletar produto' });
  }
});

// ==========================================
// ROTAS ADMIN - PEDIDOS
// ==========================================

app.get('/api/admin/orders', authenticateAdmin, (req, res) => {
  const orders = getOrders();
  res.json(orders);
});

app.get('/api/admin/orders/:id', authenticateAdmin, (req, res) => {
  const orders = getOrders();
  const order = orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }

  res.json(order);
});

app.put('/api/admin/orders/:id', authenticateAdmin, (req, res) => {
  try {
    const { status } = req.body;
    const orders = getOrders();
    const order = orders.find(o => o.id === req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();
    saveOrders(orders);

    res.json(order);
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error);
    res.status(500).json({ error: 'Erro ao atualizar pedido' });
  }
});

// ==========================================
// ROTAS ADMIN - ESTATÍSTICAS
// ==========================================

app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
  try {
    const orders = getOrders();
    const products = getProducts();

    const stats = {
      totalOrders: orders.length,
      paidOrders: orders.filter(o => o.status === 'pago').length,
      pendingOrders: orders.filter(o => o.status === 'aguardando_pagamento').length,
      totalRevenue: orders
        .filter(o => o.status === 'pago')
        .reduce((sum, o) => sum + o.total, 0),
      totalProducts: products.length,
      totalStock: products.reduce((sum, p) => sum + p.stock, 0),
      uniqueVisitors: orders.length
    };

    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║    🎮 PS2 STORE - Servidor Iniciado    ║
╚════════════════════════════════════════╝

📍 Loja:     http://localhost:${PORT}
📍 Admin:    http://localhost:${PORT}/admin
🔐 Webhook:  http://localhost:${PORT}/webhook/payment

⚙️  Certificar-se de ter configurado .env:
   • CAIXA_MERCHANT_ID
   • CAIXA_ACCESS_TOKEN
   • CAIXA_ACCOUNT_ID
   • ADMIN_USERNAME
   • ADMIN_PASSWORD

  `);
});