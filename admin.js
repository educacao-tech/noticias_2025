const Admin = {
    API_URL: 'http://localhost:3000/api/news',
    LOGIN_URL: 'http://localhost:3000/api/login',

    init() {
        const token = localStorage.getItem('auth_token');
        if (token) {
            this.showContent();
            this.loadNews();
            this.setupImagePreview();
        }
    },

    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

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
                this.setupImagePreview();
            } else {
                alert('Credenciais inválidas');
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

    setupImagePreview() {
        const imageUrlInput = document.getElementById('imageUrl');
        const imagePreview = document.getElementById('image-preview');

        imageUrlInput.addEventListener('input', () => {
            imagePreview.src = imageUrlInput.value;
            imagePreview.classList.toggle('visible', imageUrlInput.value.length > 0);
        });
    },

    showContent() {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
    },

    async loadNews() {
        const response = await fetch(this.API_URL);
        const news = await response.json();
        const list = document.getElementById('admin-list');
        list.innerHTML = '<h3>Notícias Atuais</h3>';

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