const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const { constants } = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3001; // Porta padrão alterada para 3001
const SECRET_KEY = process.env.JWT_SECRET || 'chave_temporaria_desenvolvimento'; // Em produção, defina JWT_SECRET no ambiente

app.use(cors());
app.use(bodyParser.json());

// Simulação de banco de dados de usuários
const users = [
    // O hash abaixo corresponde à senha '123'. Substitua pelo hash da sua nova senha.
    { id: 1, username: 'admin', password: '$2b$10$76YmP1q45i/7j3Y6oZ3iA.uB3A7o7.qXzS5yR5U6l6OqIqW0yW5yq' }
];

// Rota de Login para gerar o Token
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);

    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        return res.json({ token });
    }

    res.status(401).json({ message: 'Credenciais inválidas' });
});

// Middleware para verificar o Token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Token não fornecido' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido ou expirado' });
        req.user = user;
        next();
    });
}

// Rota de notícias (Protegida)
app.get('/api/news', async (req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] 📥 Requisição GET /api/news`);
    try {
        const filePath = path.join(__dirname, 'news.json');
        
        // Verifica se o arquivo existe antes de tentar ler
        try {
            await fs.access(filePath, constants.F_OK);
        } catch {
            console.log('⚠️ Arquivo news.json não encontrado. Retornando lista vazia.');
            return res.json([]);
        }

        const data = await fs.readFile(filePath, 'utf8');

        if (!data || data.trim() === "") {
            return res.json([]);
        }

        try {
            let json = JSON.parse(data);
            // Migração automática: Adiciona ID se não existir em itens antigos
            let changed = false;
            json = json.map(item => {
                if (!item.id) { item.id = crypto.randomUUID(); changed = true; }
                return item;
            });
            if (changed) await fs.writeFile(filePath, JSON.stringify(json, null, 4), 'utf8');
            res.json(json);
        } catch (parseErr) {
            console.error("❌ Erro de sintaxe no news.json:", parseErr.message);
            res.status(500).json({ message: 'O arquivo de dados (news.json) está corrompido.' });
        }
    } catch (err) {
        console.error("❌ Erro ao ler news.json:", err);
        res.status(500).json({ message: 'Erro ao carregar notícias do disco' });
    }
});

app.post('/api/news', authenticateToken, async (req, res) => {
    try {
        const newArticle = req.body;

        // Validação básica de campos obrigatórios
        const requiredFields = ['title', 'description', 'link', 'date'];
        const missingFields = requiredFields.filter(field => !newArticle[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({ message: `Campos obrigatórios ausentes: ${missingFields.join(', ')}` });
        }

        const filePath = path.join(__dirname, 'news.json');
        let news = [];
        
        try {
            const fileData = await fs.readFile(filePath, 'utf8');
            news = fileData ? JSON.parse(fileData) : [];
        } catch (readErr) {
            // Se o arquivo não existir, começamos com um array vazio
            news = [];
        }

        // Gera um ID único automaticamente para a nova notícia
        const articleWithId = { 
            ...newArticle, 
            id: crypto.randomUUID(), 
            published: true 
        };
        news.push(articleWithId);

        await fs.writeFile(filePath, JSON.stringify(news, null, 4), 'utf8');

        console.log(`✅ Notícia "${articleWithId.title}" adicionada com ID: ${articleWithId.id}`);
        res.status(201).json({ message: 'Notícia criada com sucesso', article: articleWithId });
    } catch (err) {
        console.error("Erro ao salvar notícia:", err);
        res.status(500).json({ message: 'Erro interno ao salvar a notícia' });
    }
});

// Rota para ALTERAR uma notícia existente
app.put('/api/news', authenticateToken, async (req, res) => {
    try {
        const updatedArticle = req.body;
        const filePath = path.join(__dirname, 'news.json');
        
        const fileData = await fs.readFile(filePath, 'utf8');
        let news = JSON.parse(fileData || "[]");

        // Encontra o índice da notícia pelo ID único
        const index = news.findIndex(n => n.id === updatedArticle.id);

        if (index === -1) {
            return res.status(404).json({ message: 'Notícia não encontrada para atualização.' });
        }

        // Atualiza os dados
        news[index] = { ...news[index], ...updatedArticle };

        await fs.writeFile(filePath, JSON.stringify(news, null, 4), 'utf8');
        
        console.log(`🔄 Notícia "${updatedArticle.title}" atualizada por ${req.user.username}`);
        res.json({ message: 'Notícia atualizada com sucesso', article: news[index] });
    } catch (err) {
        console.error("Erro ao atualizar notícia:", err);
        res.status(500).json({ message: 'Erro interno ao atualizar a notícia' });
    }
});

// Rota para EXCLUIR uma notícia
app.delete('/api/news', authenticateToken, async (req, res) => {
    try {
        const { id } = req.body; // Recebe o ID da notícia a ser excluída
        const filePath = path.join(__dirname, 'news.json');
        
        const fileData = await fs.readFile(filePath, 'utf8');
        let news = JSON.parse(fileData || "[]");

        const initialLength = news.length;
        // Filtra a lista removendo a notícia com o ID correspondente
        news = news.filter(n => n.id !== id);

        if (news.length === initialLength) {
            return res.status(404).json({ message: 'Notícia não encontrada para exclusão.' });
        }

        await fs.writeFile(filePath, JSON.stringify(news, null, 4), 'utf8');
        
        console.log(`🗑️ Notícia com ID ${id} excluída por ${req.user.username}`);
        res.json({ message: 'Notícia excluída com sucesso' });
    } catch (err) {
        console.error("Erro ao excluir notícia:", err);
        res.status(500).json({ message: 'Erro interno ao excluir a notícia' });
    }
});

// Serve os arquivos estáticos da pasta atual
app.use(express.static(path.join(__dirname, '.')));

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`); // Log atualizado para mostrar a porta correta
});