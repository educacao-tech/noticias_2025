const Admin = {
    API_URL: '/api/news',
    LOGIN_URL: '/api/login',
    PASSWORD_URL: '/api/change-password',
    allNews: [],
    filteredNews: [],
    currentPage: 1,
    itemsPerPage: 5, // Define quantas notícias aparecem por página

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
            this.showToast('Por favor, preencha todos os campos.', 'error');
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
                this.showToast('Credenciais inválidas', 'error');
                loginSection.classList.add('shake-animation');
                loginSection.addEventListener('animationend', () => loginSection.classList.remove('shake-animation'), { once: true });
            }
        } catch (error) {
            console.error('Erro no login:', error);
            this.showToast('Erro ao conectar com o servidor', 'error');
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

    showToast(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
    
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '';
        if (type === 'success') icon = '✅';
        else if (type === 'error') icon = '❌';
        else if (type === 'info') icon = 'ℹ️';
    
        toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
        toastContainer.appendChild(toast);
    
        setTimeout(() => {
            toast.remove();
        }, duration);
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
            this.showToast('A nova senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showToast('As senhas não coincidem. Por favor, verifique a digitação.', 'error');
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
                this.showToast('Senha alterada com sucesso!', 'success');
                this.togglePasswordSection(false);
            } else {
                this.showToast(data.message || 'Erro ao alterar senha', 'error');
                // Adiciona a animação de shake se houver erro
                passwordForm.classList.add('shake-animation');
                // Remove a classe após a animação para que possa ser re-adicionada
                passwordForm.addEventListener('animationend', () => passwordForm.classList.remove('shake-animation'), { once: true });
            }
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            this.showToast('Falha na comunicação com o servidor', 'error');
        }
    },

    setupSearch() {
        const searchInput = document.getElementById('admin-search-input');
        if (!searchInput) return;

        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase().trim();
            this.filteredNews = this.allNews.filter(item => 
                item.title.toLowerCase().includes(term) || 
                item.description.toLowerCase().includes(term)
            );
            this.currentPage = 1; // Volta para a primeira página ao buscar
            this.renderNewsList();
        });
    },

    async loadNews() {
        const response = await fetch(this.API_URL);
        this.allNews = await response.json();
        this.filteredNews = [...this.allNews];
        this.currentPage = 1;
        this.renderNewsList();
    },

    renderNewsList() {
        const list = document.getElementById('admin-news-items');
        if (!list) return;
        list.innerHTML = '';

        // Lógica de Paginação: Corta o array para exibir apenas os itens da página atual
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageItems = this.filteredNews.slice(start, end);

        pageItems.forEach(item => {
            const listItem = document.createElement('div');
            listItem.className = 'admin-list-item';
            listItem.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.altText || 'Imagem da notícia'}">
                <div class="admin-item-details">
                    <h4>${item.title}</h4>
                    <p>${item.description}</p>
                </div>
                <div class="admin-item-actions">
                    <button class="btn-edit" onclick='Admin.fillFormForEdit(${JSON.stringify(item)})'>Editar</button>
                    <button class="btn-delete" onclick="Admin.showDeleteConfirmation('${item.id}', '${item.title}')">Excluir</button>
                </div>
            `;
            list.appendChild(listItem);
        });

        this.renderPaginationControls();
    },

    renderPaginationControls() {
        const container = document.getElementById('pagination-controls');
        if (!container) return;

        const totalPages = Math.ceil(this.filteredNews.length / this.itemsPerPage);

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                onclick="Admin.changePage(${this.currentPage - 1})">Anterior</button>
            <span class="pagination-info">Página ${this.currentPage} de ${totalPages}</span>
            <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} 
                onclick="Admin.changePage(${this.currentPage + 1})">Próxima</button>
        `;
    },

    changePage(page) {
        this.currentPage = page;
        this.renderNewsList();
        // Rola suavemente para o início da lista ao mudar de página
        document.querySelector('.admin-list').scrollIntoView({ behavior: 'smooth' });
    },

    exportNewsToCSV() {
        // Exporta exatamente o que está sendo filtrado no momento
        const newsToExport = this.filteredNews;

        if (newsToExport.length === 0) { // Use showToast instead of alert
            this.showToast('Não há notícias para exportar.', 'info');
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
            } catch (e) { console.error(`Erro ao importar notícia na linha ${i}:`, e); }
        }

        this.showToast(`Importação concluída! ${successCount} notícias adicionadas.`, 'success');
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
            this.showToast('O link da notícia não é uma URL válida.', 'error');
            btn.disabled = false;
            return;
        }
        if (!this.isValidURL(article.imageUrl)) {
            this.showToast('A URL da imagem não é uma URL válida.', 'error');
            btn.disabled = false;
            return;
        }
        if (article.instagramLink && !this.isValidURL(article.instagramLink)) {
            this.showToast('O link do Instagram não é uma URL válida.', 'error');
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
                this.showToast(isEdit ? 'Notícia atualizada com sucesso!' : 'Notícia adicionada com sucesso!', 'success');
                this.resetForm();
                this.loadNews();
            }
        } catch (e) { this.showToast('Erro ao salvar a notícia.', 'error'); }
        btn.disabled = false;
    },

    openNewsModal(isEdit = false) {
        const modal = document.getElementById('news-modal');
        const title = document.getElementById('modal-title');
        if (!isEdit) {
            this.resetForm();
            title.textContent = 'Adicionar Nova Notícia';
        } else {
            title.textContent = 'Editar Notícia';
        }
        modal.classList.add('visible');
    },

    closeNewsModal() {
        const modal = document.getElementById('news-modal');
        modal.classList.remove('visible');
        this.resetForm();
    },

    fillFormForEdit(article) {
        this.openNewsModal(true);
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
        const form = document.getElementById('news-form');
        if (form) form.reset();
        const idField = document.getElementById('news-id');
        if (idField) idField.value = '';
        const editModeField = document.getElementById('edit-mode');
        if (editModeField) editModeField.value = 'false';
        const btnSubmit = document.getElementById('btn-submit');
        if (btnSubmit) btnSubmit.textContent = 'Salvar Notícia';
        const imgPreview = document.getElementById('image-preview');
        if (imgPreview) imgPreview.classList.remove('visible');
    },

    // Funções para o modal de confirmação de exclusão
    showDeleteConfirmation(id, title) {
        const modal = document.getElementById('delete-confirmation-modal');
        const newsTitleSpan = document.getElementById('news-title-to-delete');
        newsTitleSpan.textContent = title;
        modal.classList.add('visible');

        // Armazena o ID da notícia a ser excluída no botão de confirmação
        document.getElementById('confirm-delete-btn').dataset.newsId = id;

        // Adiciona listeners para os botões do modal
        document.getElementById('confirm-delete-btn').onclick = () => this.confirmDelete();
        document.getElementById('cancel-delete-btn').onclick = () => this.hideDeleteConfirmation();
    },

    hideDeleteConfirmation() {
        const modal = document.getElementById('delete-confirmation-modal');
        modal.classList.remove('visible');
        document.getElementById('confirm-delete-btn').dataset.newsId = ''; // Limpa o ID
    },

    async confirmDelete() {
        const id = document.getElementById('confirm-delete-btn').dataset.newsId;
        if (!id) return; // Não faz nada se o ID não estiver definido

        const token = localStorage.getItem('auth_token');
        
        const response = await fetch(this.API_URL, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id })
        });

        if (response.ok) {
            this.showToast('Notícia excluída com sucesso!', 'success');
            this.loadNews();
        } else {
            this.showToast('Erro ao excluir notícia.', 'error');
        }
        this.hideDeleteConfirmation(); // Esconde o modal após a ação
    }
};

// Adicione esta linha ao final do arquivo para iniciar o Admin automaticamente
document.addEventListener('DOMContentLoaded', () => Admin.init());