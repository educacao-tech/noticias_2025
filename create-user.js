const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');

async function createFirstUser() {
    const USERS_FILE = path.join(__dirname, 'users.json');
    const username = 'admin'; 
    const password = '123'; // Mude para a senha que desejar

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const users = [
            {
                id: 1,
                username: username,
                password: hashedPassword
            }
        ];

        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 4));
        console.log(`✅ Sucesso: Usuário "${username}" com a senha "${password}" foi criado no users.json.`);
    } catch (err) {
        console.error('❌ Erro ao criar usuário:', err);
    }
}

createFirstUser();