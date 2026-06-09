const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const { constants } = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');

const app = express();
const PORT = 3001; // Porta padrão alterada para 3001
const SECRET_KEY = process.env.JWT_SECRET || 'chave_temporaria_desenvolvimento'; // Em produção, defina JWT_SECRET no ambiente
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(bodyParser.json());

// Helper to initialize news data (migration logic moved here)
async function initNewsFile() {
    const filePath = path.join(__dirname, 'news.json');
    try {
        await fs.access(filePath, constants.F_OK);
        const data = await fs.readFile(filePath, 'utf8');
        if (!data || data.trim() === "") return;

        let json = JSON.parse(data);
        let changed = false;
        
        const migratedJson = json.map(item => {
            if (!item.id) {
                item.id = crypto.randomUUID();
                changed = true;
            }
            return item;
        });

        if (changed) {
            await fs.writeFile(filePath, JSON.stringify(migratedJson, null, 4), 'utf8');
            console.log('📦 News database migrated: Missing IDs added.');
        }
    } catch (err) {
        // If file doesn't exist, we don't need to migrate
        if (err.code !== 'ENOENT') console.error('Error during migration:', err);
    }
}

// Validador de URL para segurança no servidor
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Helper para ler usuários do arquivo
async function getUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Rota de Login para gerar o Token
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const users = await getUsers();
    const user = users.find(u => u.username === username);

    if (user) {
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
            return res.json({ token });
        }
        console.warn(`[Login] Senha incorreta para o usuário: "${username}"`);
    } else {
        console.warn(`[Login] Usuário não encontrado no users.json: "${username}"`);
    }

    res.status(401).json({ message: 'Credenciais inválidas' });
});

// Rota para alterar a senha do usuário logado
app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }

    const users = await getUsers();
    // Encontra o usuário no "banco de dados" pelo ID vindo do Token
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    // Verifica se a senha atual está correta
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Senha atual incorreta' });

    // Gera o novo hash e atualiza o objeto
    user.password = await bcrypt.hash(newPassword, 10);
    
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 4));
    res.json({ message: 'Senha alterada com sucesso!' });
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
    try {
        const filePath = path.join(__dirname, 'news.json');
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            if (!data || data.trim() === "") return res.json([]);
            
            const json = JSON.parse(data);
            res.json(json);
        } catch (parseErr) {
            if (parseErr.code === 'ENOENT') return res.json([]);
            throw parseErr;
        }
    } catch (err) {
        console.error("❌ Erro ao ler news.json:", err);
        res.status(500).json({ message: 'Erro ao carregar notícias' });
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

        // Validação de URLs obrigatórias
        if (!isValidURL(newArticle.link) || !isValidURL(newArticle.imageUrl)) {
            return res.status(400).json({ message: 'As URLs de link ou imagem são inválidas.' });
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

        // Validação de URLs na atualização
        if (!isValidURL(updatedArticle.link) || !isValidURL(updatedArticle.imageUrl)) {
            return res.status(400).json({ message: 'As URLs fornecidas para atualização são inválidas.' });
        }

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

// Atalho para facilitar o acesso: http://localhost:3001/admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve os arquivos estáticos da pasta atual
app.use(express.static(path.join(__dirname, '.')));

app.listen(PORT, async () => {
    // Run migration once on startup
    await initNewsFile();
    console.log(`Servidor rodando em http://localhost:${PORT}`);

    // Abre o navegador automaticamente apenas na primeira vez (evita novas abas no restart do nodemon)
    if (process.env.OPEN_BROWSER_ON_START === 'true') {
        const lockPath = path.join(__dirname, '.browser_lock');
        try {
            await fs.access(lockPath, constants.F_OK);
        } catch (err) {
            // Se o arquivo não existe, abre o navegador e cria a trava
            const url = `http://localhost:${PORT}`;
            const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
            exec(`${start} ${url}`);
            await fs.writeFile(lockPath, 'opened');
        }
    }
});