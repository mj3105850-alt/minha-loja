# 🎮 PS2 Store - E-commerce com Pix Caixa

Sistema completo de e-commerce para loja de jogos PS2 com **Pix pela Caixa Econômica Federal**.

## 🚀 Funcionalidades

### Para o Cliente
- ✅ Catálogo de produtos com imagens
- ✅ Busca e filtro por categoria
- ✅ Carrinho de compras
- ✅ QR Code Pix (gerado pela Caixa)
- ✅ Código Pix copia-e-cola
- ✅ Verificação automática de pagamento
- ✅ Layout responsivo (mobile-friendly)

### Para o Administrador
- ✅ Painel /admin protegido por senha
- ✅ Dashboard com estatísticas
  - 📊 Número de visitantes
  - 👀 Número de visitas
  - 🛒 Número de pedidos
  - ✅ Pedidos pagos
  - 💰 Faturamento total
- ✅ Gerenciar produtos
  - 📦 Criar produtos
  - ✏️ Editar produto
  - 💵 Alterar preço
  - 📦 Alterar estoque
  - 🖼️ Alterar imagem
  - 🗑️ Deletar produto
- ✅ Gerenciar pedidos
  - 📋 Ver todos os pedidos
  - 📍 Ver status do pagamento
  - 🔄 Alterar status manualmente

---

## 📋 Pré-requisitos

- **Node.js** 14+ instalado
- **NPM** ou **Yarn**
- Conta na **Caixa Econômica Federal** (para credenciais Pix)

---

## 🔧 Instalação

### 1. Clonar o repositório
```bash
git clone https://github.com/mj3105850-alt/minha-loja.git
cd minha-loja
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e preencha com suas credenciais:

```bash
cp .env.example .env
```

Edite o arquivo `.env`:
```
# Caixa Pix
CAIXA_MERCHANT_ID=seu_merchant_id
CAIXA_ACCESS_TOKEN=seu_access_token
CAIXA_ACCOUNT_ID=sua_conta

# Servidor
PORT=3000
NODE_ENV=development

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=sua_senha_forte

# JWT
JWT_SECRET=sua_chave_secreta_muito_forte

# Base URL (para webhooks)
BASE_URL=http://localhost:3000
```

### 4. Iniciar o servidor

**Desenvolvimento:**
```bash
npm run dev
```

**Produção:**
```bash
npm start
```

O servidor estará disponível em: `http://localhost:3000`

---

## 🌐 Acessando o Sistema

### Loja para Clientes
```
http://localhost:3000/
```

### Painel Admin
```
http://localhost:3000/admin
```

**Credenciais padrão:**
- Usuário: `admin`
- Senha: `admin123` (mude em `.env`)

---

## 🏗️ Estrutura do Projeto

```
minha-loja/
├── server.js              # Backend Express
├── package.json           # Dependências
├── .env                   # Variáveis de ambiente (não commitar)
├── .env.example           # Exemplo de .env
├── .gitignore             # Arquivos ignorados
├── products.json          # Banco de dados de produtos
├── orders.json            # Pedidos (gerado automaticamente)
├── index.html             # Loja (frontend)
├── admin.html             # Painel admin (frontend)
└── README.md              # Este arquivo
```

---

## 📡 API Endpoints

### Públicos (Loja)

#### Produtos
- `GET /api/products` - Listar todos os produtos
- `GET /api/products/:id` - Detalhes de um produto

#### Pedidos
- `POST /api/orders` - Criar novo pedido com Pix
- `GET /api/orders/:id` - Consultar pedido

### Protegidos (Admin)

#### Autenticação
- `POST /api/admin/login` - Login (retorna JWT)

#### Produtos (requer autenticação)
- `POST /api/admin/products` - Criar produto
- `PUT /api/admin/products/:id` - Atualizar produto
- `DELETE /api/admin/products/:id` - Deletar produto

#### Pedidos (requer autenticação)
- `GET /api/admin/orders` - Listar todos os pedidos
- `GET /api/admin/orders/:id` - Detalhes do pedido
- `PUT /api/admin/orders/:id` - Alterar status

#### Estatísticas (requer autenticação)
- `GET /api/admin/stats` - Dashboard com números

### Webhooks

#### Caixa Pix
- `POST /webhook/payment` - Confirmação automática de pagamento da Caixa

---

## 🔐 Fluxo de Pagamento Pix

```
1. Cliente adiciona produtos ao carrinho
   ↓
2. Cliente clica "Finalizar compra"
   ↓
3. Sistema cria pedido no servidor
   ↓
4. Servidor requisita QR Code à Caixa
   ↓
5. QR Code retorna com código Pix
   ↓
6. Cliente vê QR Code + código copia-e-cola
   ↓
7. Cliente escaneia com seu banco
   ↓
8. Caixa confirma pagamento via webhook
   ↓
9. Pedido muda para status "pago" automaticamente
   ↓
10. Cliente recebe confirmação
```

---

## 🔄 Webhook Caixa

O servidor possui um endpoint webhook que recebe confirmações de pagamento:

```
POST http://seu-dominio.com/webhook/payment
```

**Corpo esperado:**
```json
{
  "transactionId": "ORD-1234567890",
  "status": "paid",
  "amount": 2500
}
```

**Configurar na Caixa:**
1. Acessar Portal Caixa
2. Configurar URL do webhook: `https://seu-dominio.com/webhook/payment`
3. Caixa enviará notificações automaticamente

---

## 💡 Como Obter Credenciais Caixa

### Passo 1: Acessar Portal Caixa
1. Acesse: https://www.caixa.gov.br/empresas
2. Faça login com sua conta

### Passo 2: Solicitar Integração Pix
1. Vá em "Meios de Pagamento" → "Pix para Empresas"
2. Clique em "Solicitar Integração"

### Passo 3: Gerar Credenciais
1. Você receberá:
   - **CAIXA_MERCHANT_ID** - ID da sua loja
   - **CAIXA_ACCESS_TOKEN** - Token de acesso
   - **CAIXA_ACCOUNT_ID** - ID da conta

### Passo 4: Configurar em .env
Cole os valores no arquivo `.env`

---

## 🚀 Deploy

### Heroku
```bash
# Fazer login
heroku login

# Criar app
heroku create seu-app-name

# Configurar variáveis
heroku config:set CAIXA_MERCHANT_ID=xxx
heroku config:set CAIXA_ACCESS_TOKEN=yyy

# Deploy
git push heroku main
```

### Railway / Render
```bash
# Conectar repositório GitHub
# Configurar variáveis de ambiente
# Deploy automático
```

---

## 🛠️ Troubleshooting

### Erro: "CAIXA_MERCHANT_ID não definido"
- Verificar `.env` está correto
- Não cometer `.env` no Git

### Erro: "Token inválido no admin"
- JWT pode ter expirado (24h de validade)
- Fazer login novamente

### Webhook não funciona
- Verificar URL pública está correta
- Testar com curl:
```bash
curl -X POST http://localhost:3000/webhook/payment \
  -H "Content-Type: application/json" \
  -d '{"transactionId":"ORD-123","status":"paid"}'
```

---

## 📚 Documentação Caixa

- [Documentação Caixa Pix](https://www.caixa.gov.br/desenvolvimento)
- [API Caixa E-commerce](https://www.caixa.gov.br/api-docs)
- [Guia Integração Pix](https://www.caixa.gov.br/pix-docs)

---

## 📝 Licença

MIT

---

**PS2 STORE © 2026** - Desenvolvido com ❤️
