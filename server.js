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
const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.JWT_SECRET || 'chave_temporaria_desenvolvimento';
const USERS_FILE = path.join(__dirname, 'users.json');
const NEWS_FILE = path.join(__dirname, 'news.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BACKUPS_DIR = path.join(__dirname, 'backups');

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Servir arquivos estáticos de upload de imagens
app.use('/uploads', express.static(UPLOADS_DIR));

// Helper para inicializar arquivo de notícias e migrações
async function initNewsFile() {
    try {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        await fs.mkdir(BACKUPS_DIR, { recursive: true });

        await fs.access(NEWS_FILE, constants.F_OK);
        const data = await fs.readFile(NEWS_FILE, 'utf8');
        if (!data || data.trim() === '') return;

        let json = JSON.parse(data);
        let changed = false;

        const migratedJson = json.map(item => {
            if (!item.id) {
                item.id = crypto.randomUUID();
                changed = true;
            }
            if (item.published === undefined) {
                item.published = true;
                changed = true;
            }
            if (!item.category) {
                item.category = 'Educação Básica';
                changed = true;
            }
            if (item.views === undefined) {
                item.views = Math.floor(Math.random() * 150) + 30; // Inicializa com acessos razoáveis
                changed = true;
            }
            if (!item.gallery) {
                item.gallery = [];
                changed = true;
            }
            if (!item.reactions || typeof item.reactions !== 'object') {
                item.reactions = { love: Math.floor(Math.random() * 18) + 4, clap: Math.floor(Math.random() * 15) + 3, idea: Math.floor(Math.random() * 12) + 2, party: Math.floor(Math.random() * 10) + 1 };
                changed = true;
            }
            if (item.publishAt === undefined) {
                item.publishAt = null;
                changed = true;
            }
            return item;
        });

        if (changed) {
            await fs.writeFile(NEWS_FILE, JSON.stringify(migratedJson, null, 4), 'utf8');
            console.log('📦 Banco de notícias atualizado com IDs, categorias e status de publicação.');
        }
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('Erro ao inicializar notícias:', err);
    }
}

// Backup automático de segurança do banco news.json
async function backupNewsDatabase() {
    try {
        await fs.mkdir(BACKUPS_DIR, { recursive: true });
        const data = await fs.readFile(NEWS_FILE, 'utf8');
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupPath = path.join(BACKUPS_DIR, `news_${timestamp}.json`);
        await fs.writeFile(backupPath, data, 'utf8');

        // Limita a 30 backups para não ocupar disco
        const files = await fs.readdir(BACKUPS_DIR);
        const jsonBackups = files.filter(f => f.startsWith('news_') && f.endsWith('.json')).sort();
        if (jsonBackups.length > 30) {
            for (let i = 0; i < jsonBackups.length - 30; i++) {
                await fs.unlink(path.join(BACKUPS_DIR, jsonBackups[i]));
            }
        }
    } catch (err) {
        console.warn('Aviso: falha ao gerar backup automático:', err.message);
    }
}

// Validador de URL seguro (aceita URLs completas e relativas de upload)
function isValidURL(string) {
    if (!string || typeof string !== 'string') return false;
    if (string.startsWith('/uploads/') || string.startsWith('uploads/')) return true;
    try {
        const parsed = new URL(string);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'data:';
    } catch (_) {
        return false;
    }
}

// Helper para ler usuários
async function getUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Middleware de Proteção contra Força Bruta (Rate Limiting no Login)
const loginAttempts = new Map();
function rateLimitLogin(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'ip';
    const now = Date.now();
    const entry = loginAttempts.get(ip) || { count: 0, firstAttempt: now };

    if (now - entry.firstAttempt > 60000) {
        entry.count = 0;
        entry.firstAttempt = now;
    }

    if (entry.count >= 5) {
        const waitSec = Math.ceil((60000 - (now - entry.firstAttempt)) / 1000);
        return res.status(429).json({
            message: `Muitas tentativas incorretas. Por segurança, aguarde ${waitSec} segundos.`
        });
    }

    req.recordFailedLogin = () => {
        entry.count++;
        loginAttempts.set(ip, entry);
    };

    req.resetFailedLogin = () => {
        loginAttempts.delete(ip);
    };

    next();
}

// Middleware de autenticação JWT
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

/* ========================================================
   Rotas de Autenticação e Usuários
   ======================================================== */

// Login com rate limiter
app.post('/api/login', rateLimitLogin, async (req, res) => {
    const { username, password } = req.body;
    const users = await getUsers();
    const user = users.find(u => u.username === username);

    if (user) {
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            req.resetFailedLogin();
            const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '8h' });
            return res.json({ token, username: user.username });
        }
        req.recordFailedLogin();
        console.warn(`[Login] Senha incorreta para o usuário: "${username}"`);
    } else {
        req.recordFailedLogin();
        console.warn(`[Login] Usuário não encontrado: "${username}"`);
    }

    res.status(401).json({ message: 'Credenciais inválidas' });
});

// Alterar senha do usuário logado
app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }

    const users = await getUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Senha atual incorreta' });

    user.password = await bcrypt.hash(newPassword, 10);
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 4), 'utf8');
    res.json({ message: 'Senha alterada com sucesso!' });
});

// Listar todos os usuários (Protegido - omite as senhas)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const users = await getUsers();
        const safeUsers = users.map(u => ({ id: u.id, username: u.username }));
        res.json(safeUsers);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao listar usuários' });
    }
});

// Criar novo usuário (Protegido)
app.post('/api/users', authenticateToken, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password || password.length < 6) {
            return res.status(400).json({ message: 'Usuário e senha com pelo menos 6 caracteres são obrigatórios.' });
        }

        const users = await getUsers();
        if (users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
            return res.status(400).json({ message: 'Já existe um usuário com esse nome.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: crypto.randomUUID(),
            username: username.trim(),
            password: hashedPassword
        };

        users.push(newUser);
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 4), 'utf8');

        res.status(201).json({ message: 'Usuário criado com sucesso!', user: { id: newUser.id, username: newUser.username } });
    } catch (err) {
        console.error('Erro ao criar usuário:', err);
        res.status(500).json({ message: 'Erro ao criar usuário' });
    }
});

// Excluir usuário (Protegido)
app.delete('/api/users', authenticateToken, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ message: 'ID do usuário é obrigatório.' });

        if (req.user && req.user.id === id) {
            return res.status(400).json({ message: 'Você não pode excluir o seu próprio usuário logado.' });
        }

        let users = await getUsers();
        if (users.length <= 1) {
            return res.status(400).json({ message: 'Não é possível excluir o único administrador do sistema.' });
        }

        const initialLen = users.length;
        users = users.filter(u => u.id !== id);
        if (users.length === initialLen) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 4), 'utf8');
        res.json({ message: 'Usuário excluído com sucesso!' });
    } catch (err) {
        console.error('Erro ao excluir usuário:', err);
        res.status(500).json({ message: 'Erro interno ao excluir usuário' });
    }
});

/* ========================================================
   Upload Físico de Imagens para /uploads
   ======================================================== */
app.post('/api/upload', authenticateToken, async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ message: 'Nenhuma imagem enviada.' });

        // Valida e decodifica base64
        const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ message: 'Formato de imagem inválido. Envie uma imagem válida.' });
        }

        const rawExt = matches[1].toLowerCase();
        const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `news_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);

        console.log(`📸 Imagem salva no disco: /uploads/${filename}`);
        res.json({ url: `/uploads/${filename}`, message: 'Imagem enviada com sucesso!' });
    } catch (err) {
        console.error('Erro no upload de imagem:', err);
        res.status(500).json({ message: 'Falha ao salvar a imagem no servidor.' });
    }
});

/* ========================================================
   Rotas de Notícias (CRUD)
   ======================================================== */

// Listar notícias (Pública para visitantes; aceita ?all=true para o painel admin)
app.get('/api/news', async (req, res) => {
    try {
        const data = await fs.readFile(NEWS_FILE, 'utf8');
        if (!data || data.trim() === '') return res.json([]);
        const json = JSON.parse(data);

        // Se req.query.all === 'true' (painel administrativo), retorna todas
        if (req.query.all === 'true') {
            return res.json(json);
        }

        // Para o portal público de visitantes: oculta despublicadas e agendadas para o futuro
        const now = new Date();
        const visible = json.filter(item => {
            if (item.published === false) return false;
            if (item.publishAt && new Date(item.publishAt) > now) return false;
            return true;
        });

        res.json(visible);
    } catch (err) {
        if (err.code === 'ENOENT') return res.json([]);
        console.error('❌ Erro ao ler news.json:', err);
        res.status(500).json({ message: 'Erro ao carregar notícias' });
    }
});


// Registrar visualização de notícia (Anônimo e público)
const recentViewsMap = new Map();
app.post('/api/news/view', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ message: 'ID da notícia obrigatório.' });

        const ip = req.ip || req.connection.remoteAddress || 'ip';
        const key = `${ip}_${id}`;
        const now = Date.now();

        // Evita contabilizar acessos múltiplos do mesmo IP em menos de 5 minutos
        if (recentViewsMap.has(key) && (now - recentViewsMap.get(key) < 5 * 60 * 1000)) {
            return res.json({ message: 'Visualização já computada recentemente.' });
        }
        recentViewsMap.set(key, now);

        const data = await fs.readFile(NEWS_FILE, 'utf8');
        let news = JSON.parse(data || '[]');
        const index = news.findIndex(n => n.id === id);

        if (index !== -1) {
            news[index].views = (news[index].views || 0) + 1;
            await fs.writeFile(NEWS_FILE, JSON.stringify(news, null, 4), 'utf8');
            return res.json({ id, views: news[index].views });
        }

        res.status(404).json({ message: 'Notícia não encontrada.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao registrar visualização.' });
    }
});

// Criar notícia (Protegida)

// Registrar reação de emoji em notícia (Anônimo e público)
app.post('/api/news/react', async (req, res) => {
    try {
        const { id, reaction } = req.body;
        const allowed = ['love', 'clap', 'idea', 'party'];
        if (!id || !reaction || !allowed.includes(reaction)) {
            return res.status(400).json({ message: 'Parâmetros de reação inválidos.' });
        }

        const data = await fs.readFile(NEWS_FILE, 'utf8');
        let news = JSON.parse(data || '[]');
        const index = news.findIndex(n => n.id === id);
        if (index === -1) {
            return res.status(404).json({ message: 'Notícia não encontrada.' });
        }

        if (!news[index].reactions) {
            news[index].reactions = { love: 0, clap: 0, idea: 0, party: 0 };
        }
        news[index].reactions[reaction] = (news[index].reactions[reaction] || 0) + 1;

        await fs.writeFile(NEWS_FILE, JSON.stringify(news, null, 4), 'utf8');
        res.json({ id, reactions: news[index].reactions });
    } catch (err) {
        console.error('Erro ao registrar reação:', err);
        res.status(500).json({ message: 'Erro ao registrar reação.' });
    }
});

app.post('/api/news', authenticateToken, async (req, res) => {
    try {
        const newArticle = req.body;

        const requiredFields = ['title', 'description', 'link', 'date'];
        const missingFields = requiredFields.filter(f => !newArticle[f]);
        if (missingFields.length > 0) {
            return res.status(400).json({ message: `Campos obrigatórios ausentes: ${missingFields.join(', ')}` });
        }

        if (!isValidURL(newArticle.link) || !isValidURL(newArticle.imageUrl)) {
            return res.status(400).json({ message: 'As URLs de link ou imagem são inválidas.' });
        }

        // Backup preventivo antes de gravar
        await backupNewsDatabase();

        let news = [];
        try {
            const fileData = await fs.readFile(NEWS_FILE, 'utf8');
            news = fileData ? JSON.parse(fileData) : [];
        } catch (_) {
            news = [];
        }

        const articleWithId = {
            id: crypto.randomUUID(),
            title: newArticle.title.trim(),
            link: newArticle.link.trim(),
            imageUrl: newArticle.imageUrl.trim(),
            date: newArticle.date,
            displayDate: newArticle.displayDate ? newArticle.displayDate.trim() : newArticle.date,
            description: newArticle.description.trim(),
            readMoreText: newArticle.readMoreText ? newArticle.readMoreText.trim() : 'Leia Mais',
            instagramLink: newArticle.instagramLink ? newArticle.instagramLink.trim() : '',
            altText: newArticle.altText ? newArticle.altText.trim() : '',
            category: newArticle.category ? newArticle.category.trim() : 'Educação Básica',
            featured: Boolean(newArticle.featured),
            published: newArticle.published !== false,
            views: typeof newArticle.views === 'number' ? newArticle.views : 0,
            gallery: Array.isArray(newArticle.gallery) ? newArticle.gallery : [],
            publishAt: newArticle.publishAt || null,
            reactions: newArticle.reactions || { love: 0, clap: 0, idea: 0, party: 0 }
        };

        // Adiciona no topo
        news.unshift(articleWithId);

        await fs.writeFile(NEWS_FILE, JSON.stringify(news, null, 4), 'utf8');
        console.log(`✅ Notícia "${articleWithId.title}" criada por ${req.user.username}`);
        res.status(201).json({ message: 'Notícia criada com sucesso!', article: articleWithId });
    } catch (err) {
        console.error('Erro ao salvar notícia:', err);
        res.status(500).json({ message: 'Erro interno ao salvar a notícia' });
    }
});

// Alterar notícia existente (Protegida)
app.put('/api/news', authenticateToken, async (req, res) => {
    try {
        const updatedArticle = req.body;
        if (!updatedArticle.id) {
            return res.status(400).json({ message: 'ID da notícia não fornecido para atualização.' });
        }

        if (!isValidURL(updatedArticle.link) || !isValidURL(updatedArticle.imageUrl)) {
            return res.status(400).json({ message: 'As URLs fornecidas para atualização são inválidas.' });
        }

        // Backup preventivo
        await backupNewsDatabase();

        const fileData = await fs.readFile(NEWS_FILE, 'utf8');
        let news = JSON.parse(fileData || '[]');

        const index = news.findIndex(n => n.id === updatedArticle.id);
        if (index === -1) {
            return res.status(404).json({ message: 'Notícia não encontrada para atualização.' });
        }

        news[index] = {
            ...news[index],
            ...updatedArticle,
            published: updatedArticle.published !== false,
            featured: Boolean(updatedArticle.featured),
            views: updatedArticle.views !== undefined ? updatedArticle.views : (news[index].views || 0),
            gallery: Array.isArray(updatedArticle.gallery) ? updatedArticle.gallery : (news[index].gallery || []),
            publishAt: updatedArticle.publishAt !== undefined ? updatedArticle.publishAt : (news[index].publishAt || null),
            reactions: updatedArticle.reactions || news[index].reactions || { love: 0, clap: 0, idea: 0, party: 0 }
        };

        await fs.writeFile(NEWS_FILE, JSON.stringify(news, null, 4), 'utf8');
        console.log(`🔄 Notícia "${updatedArticle.title}" atualizada por ${req.user.username}`);
        res.json({ message: 'Notícia atualizada com sucesso!', article: news[index] });
    } catch (err) {
        console.error('Erro ao atualizar notícia:', err);
        res.status(500).json({ message: 'Erro interno ao atualizar a notícia' });
    }
});

// Excluir notícia (Protegida)
app.delete('/api/news', authenticateToken, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ message: 'ID da notícia não informado.' });

        await backupNewsDatabase();

        const fileData = await fs.readFile(NEWS_FILE, 'utf8');
        let news = JSON.parse(fileData || '[]');

        const initialLength = news.length;
        news = news.filter(n => n.id !== id);

        if (news.length === initialLength) {
            return res.status(404).json({ message: 'Notícia não encontrada para exclusão.' });
        }

        await fs.writeFile(NEWS_FILE, JSON.stringify(news, null, 4), 'utf8');
        console.log(`🗑️ Notícia ID ${id} excluída por ${req.user.username}`);
        res.json({ message: 'Notícia excluída com sucesso!' });
    } catch (err) {
        console.error('Erro ao excluir notícia:', err);
        res.status(500).json({ message: 'Erro interno ao excluir a notícia' });
    }
});

// Rota de atalho para o painel administrativo
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Servir arquivos estáticos da raiz
app.use(express.static(path.join(__dirname, '.')));

app.listen(PORT, async () => {
    await initNewsFile();
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);

    if (process.env.OPEN_BROWSER_ON_START === 'true') {
        const lockPath = path.join(__dirname, '.browser_lock');
        try {
            await fs.access(lockPath, constants.F_OK);
        } catch (_) {
            console.log('🌐 Abrindo o navegador...');
            const url = `http://localhost:${PORT}`;
            const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd /c start' : 'xdg-open';
            exec(`${start} ${url}`);
            await fs.writeFile(lockPath, 'opened');
        }
    }
});
