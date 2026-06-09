const Admin = {
    API_URL: '/api/news',
    LOGIN_URL: '/api/login',
    PASSWORD_URL: '/api/change-password',
    allNews: [],

    init() {
        // Configurações que devem funcionar mesmo na tela de login
        this.setupPasswordVisibilityToggles();
        this.setupImagePreview();

        const token = localStorage.getItem('auth_token');
        if (token) {
            this.showContent();
            this.loadNews();
            this.setupPasswordStrength();
            this.setupSearch();
            this.setupCSVImport();
        }
    },

    async login() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        const loginSection = document.getElementById('login-section');
        loginSection.classList.remove('shake-animation');

        if (!username || !password) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        try {
            const response = await fetch(this.LOGIN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('auth_token', data.token);
                this.showContent();
                this.loadNews();
                // Inicializa os módulos que dependem de estar logado
                this.setupPasswordStrength();
                this.setupSearch();
                this.setupCSVImport();
            } else {
                alert('Credenciais inválidas');
                loginSection.classList.add('shake-animation');
                loginSection.addEventListener('animationend', () => loginSection.classList.remove('shake-animation'), { once: true });
            }
        } catch (error) {
            console.error('Erro no login:', error);
            alert('Erro ao conectar com o servidor');
        }
    },

    logout() {
        localStorage.removeItem('auth_token');
        location.reload();
    },

    setupPasswordVisibilityToggles() {
        document.querySelectorAll('.toggle-password-visibility').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const targetId = toggle.dataset.target;
                const passwordInput = document.getElementById(targetId);
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    toggle.textContent = '🙈'; // Ícone de olho fechado
                } else {
                    passwordInput.type = 'password';
                    toggle.textContent = '👁️'; // Ícone de olho aberto
                }
            });
        });
    },

    setupImagePreview() {
        const imageUrlInput = document.getElementById('imageUrl');
        const imagePreview = document.getElementById('image-preview');

        imageUrlInput.addEventListener('input', () => {
            const url = imageUrlInput.value.trim();
            if (this.isValidURL(url)) {
                imagePreview.src = url;
                imagePreview.classList.add('visible');
            } else {
                imagePreview.classList.remove('visible');
            }
        });

        imagePreview.onerror = () => imagePreview.classList.remove('visible');
    },

    showContent() {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
    },

    togglePasswordSection(show) {
        const section = document.getElementById('password-section');
        section.classList.toggle('hidden', !show);
        if (!show) document.getElementById('password-form').reset();
        this.resetStrengthMeter();
    },

    setupPasswordStrength() {
        const passwordInput = document.getElementById('new-password');
        const strengthBar = document.getElementById('strength-bar');
        const strengthText = document.getElementById('strength-text');

        if (!passwordInput) return;

        passwordInput.addEventListener('input', () => {
            const val = passwordInput.value;
            let strength = 0;

            if (val.length >= 6) strength++;
            if (val.length >= 10) strength++;
            if (/[A-Z]/.test(val)) strength++;
            if (/[0-9]/.test(val)) strength++;
            if (/[^A-Za-z0-9]/.test(val)) strength++;

            const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c'];
            const labels = ['Fraca', 'Razoável', 'Boa', 'Forte', 'Muito Forte'];

            if (val.length === 0) {
                this.resetStrengthMeter();
            } else {
                strengthBar.style.width = (strength * 20) + '%';
                strengthBar.style.backgroundColor = colors[strength - 1] || colors[0];
                strengthText.textContent = `Força: ${labels[strength - 1] || labels[0]}`;
                strengthText.style.color = colors[strength - 1] || colors[0];
            }
        });
    },

    resetStrengthMeter() {
        const bar = document.getElementById('strength-bar');
        const text = document.getElementById('strength-text');
        if (bar) bar.style.width = '0';
        if (text) text.textContent = '';
    },

    isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    },

    async changePassword(event) {
        event.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const token = localStorage.getItem('auth_token');

        if (newPassword.length < 6) {
            alert('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('As senhas não coincidem. Por favor, verifique a digitação.');
            return;
        }
        
        const passwordForm = document.getElementById('password-form');
        passwordForm.classList.remove('shake-animation'); // Remove antes de adicionar para permitir re-trigger

        try {
            const response = await fetch(this.PASSWORD_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Senha alterada com sucesso!');
                this.togglePasswordSection(false);
            } else {
                alert(data.message || 'Erro ao alterar senha');
                // Adiciona a animação de shake se houver erro
                passwordForm.classList.add('shake-animation');
                // Remove a classe após a animação para que possa ser re-adicionada
                passwordForm.addEventListener('animationend', () => passwordForm.classList.remove('shake-animation'), { once: true });
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Falha na comunicação com o servidor');
        }
    },

    setupSearch() {
        const searchInput = document.getElementById('admin-search-input');
        if (!searchInput) return;

        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase().trim();
            const filtered = this.allNews.filter(item => 
                item.title.toLowerCase().includes(term) || 
                item.description.toLowerCase().includes(term)
            );
            this.renderNewsList(filtered);
        });
    },

    async loadNews() {
        const response = await fetch(this.API_URL);
        this.allNews = await response.json();
        this.renderNewsList(this.allNews);
    },

    renderNewsList(news) {
        const list = document.getElementById('admin-news-items');
        if (!list) return;
        list.innerHTML = '';

        news.forEach(item => {
            const div = document.createElement('div');
            div.className = 'admin-item';
            div.innerHTML = `
                <span>${item.title}</span>
                <div>
                    <button class="btn-edit" onclick='Admin.fillFormForEdit(${JSON.stringify(item)})'>Editar</button>
                    <button class="btn-delete" onclick="Admin.deleteNews('${item.id}')">Excluir</button>
                </div>
            `;
            list.appendChild(div);
        });
    },

    exportNewsToCSV() {
        // Decide qual lista exportar: a filtrada ou todas as notícias
        const searchInput = document.getElementById('admin-search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        const newsToExport = searchTerm 
            ? this.allNews.filter(item => 
                item.title.toLowerCase().includes(searchTerm) || 
                item.description.toLowerCase().includes(searchTerm)
              )
            : this.allNews;

        if (newsToExport.length === 0) {
            alert('Não há notícias para exportar.');
            return;
        }

        const headers = ['ID', 'Título', 'Data', 'Link', 'URL da Imagem', 'Descrição', 'Link Instagram', 'Texto Alternativo'];
        const csvRows = [];
        csvRows.push(headers.join(',')); // Adiciona o cabeçalho

        newsToExport.forEach(item => {
            const values = [
                `"${item.id || ''}"`, // Garante que o ID seja tratado como string
                `"${item.title.replace(/"/g, '""')}"`, // Escapa aspas duplas
                `"${item.date || ''}"`,
                `"${item.link.replace(/"/g, '""')}"`,
                `"${item.imageUrl.replace(/"/g, '""')}"`,
                `"${item.description.replace(/"/g, '""')}"`,
                `"${item.instagramLink ? item.instagramLink.replace(/"/g, '""') : ''}"`,
                `"${item.altText ? item.altText.replace(/"/g, '""') : ''}"`
            ];
            csvRows.push(values.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `noticias_exportadas_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href); // Libera o objeto URL
    },

    triggerCSVImport() {
        document.getElementById('csv-import-input').click();
    },

    setupCSVImport() {
        const fileInput = document.getElementById('csv-import-input');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => this.processCSV(event.target.result);
            reader.readAsText(file);
            fileInput.value = ''; // Limpa para permitir re-importação do mesmo arquivo
        });
    },

    async processCSV(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) return;

        const token = localStorage.getItem('auth_token');
        let successCount = 0;

        // Pula o cabeçalho
        for (let i = 1; i < lines.length; i++) {
            const columns = this.parseCSVRow(lines[i]);
            if (columns.length < 6) continue;

            const article = {
                title: columns[1],
                date: columns[2],
                displayDate: columns[2], // Fallback simples
                link: columns[3],
                imageUrl: columns[4],
                description: columns[5],
                instagramLink: columns[6] || '',
                altText: columns[7] || '',
                readMoreText: 'Leia Mais',
                published: true
            };

            // Ignora linhas com URLs fundamentais inválidas
            if (!this.isValidURL(article.link) || !this.isValidURL(article.imageUrl)) {
                console.warn(`Linha ${i} ignorada: URL da notícia ou da imagem inválida.`);
                continue;
            }

            try {
                const response = await fetch(this.API_URL, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(article)
                });
                if (response.ok) successCount++;
            } catch (e) { console.error(`Erro na linha ${i}:`, e); }
        }

        alert(`Importação concluída! ${successCount} notícias adicionadas.`);
        this.loadNews();
    },

    parseCSVRow(row) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"' && row[i + 1] === '"') { current += '"'; i++; }
            else if (char === '"') { inQuotes = !inQuotes; }
            else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
            else { current += char; }
        }
        result.push(current);
        return result;
    },

    async handleSubmit(event) {
        event.preventDefault();
        const btn = document.getElementById('btn-submit');
        btn.disabled = true;

        const token = localStorage.getItem('auth_token');
        const isEdit = document.getElementById('edit-mode').value === 'true';
        
        const article = {
            id: document.getElementById('news-id').value,
            title: document.getElementById('title').value,
            link: document.getElementById('link').value,
            imageUrl: document.getElementById('imageUrl').value,
            date: document.getElementById('date').value,
            displayDate: document.getElementById('displayDate').value,
            description: document.getElementById('description').value,
            readMoreText: document.getElementById('readMoreText').value,
            instagramLink: document.getElementById('instagramLink').value,
            altText: document.getElementById('altText').value,
            published: true
        };

        // Validação de URLs antes de enviar para o servidor
        if (!this.isValidURL(article.link)) {
            alert('O link da notícia não é uma URL válida.');
            btn.disabled = false;
            return;
        }
        if (!this.isValidURL(article.imageUrl)) {
            alert('A URL da imagem não é uma URL válida.');
            btn.disabled = false;
            return;
        }
        if (article.instagramLink && !this.isValidURL(article.instagramLink)) {
            alert('O link do Instagram não é uma URL válida.');
            btn.disabled = false;
            return;
        }

        try {
            const response = await fetch(this.API_URL, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(article)
            });

            if (response.ok) {
                alert(isEdit ? 'Atualizado!' : 'Adicionado!');
                this.resetForm();
                this.loadNews();
            }
        } catch (e) { alert('Erro ao salvar'); }
        btn.disabled = false;
    },

    fillFormForEdit(article) {
        document.getElementById('news-id').value = article.id;
        document.getElementById('title').value = article.title;
        document.getElementById('link').value = article.link;
        document.getElementById('imageUrl').value = article.imageUrl;
        document.getElementById('date').value = article.date;
        document.getElementById('displayDate').value = article.displayDate;
        document.getElementById('description').value = article.description;
        document.getElementById('readMoreText').value = article.readMoreText;
        document.getElementById('instagramLink').value = article.instagramLink;
        document.getElementById('altText').value = article.altText;
        
        document.getElementById('edit-mode').value = 'true';
        document.getElementById('btn-submit').textContent = 'Atualizar Notícia';
        
        const imgPreview = document.getElementById('image-preview');
        imgPreview.src = article.imageUrl;
        imgPreview.classList.add('visible');
    },

    resetForm() {
        document.getElementById('news-form').reset();
        document.getElementById('news-id').value = '';
        document.getElementById('edit-mode').value = 'false';
        document.getElementById('btn-submit').textContent = 'Adicionar Notícia';
        document.getElementById('image-preview').classList.remove('visible');
    },

    async deleteNews(id) {
        if (!confirm('Excluir esta notícia?')) return;
        const token = localStorage.getItem('auth_token');
        
        const response = await fetch(this.API_URL, {
            method: 'DELETE',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id })
        });

        if (response.ok) this.loadNews();
    }
};

// Adicione esta linha ao final do arquivo para iniciar o Admin automaticamente
document.addEventListener('DOMContentLoaded', () => Admin.init());