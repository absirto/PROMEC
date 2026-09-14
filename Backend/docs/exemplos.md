# Exemplos de uso de filas Bull no ProMEC

## Exemplo: e-mail de boas-vindas ao criar usuário

Quando um usuário é criado, um job do tipo `email` é adicionado à fila `general-queue`:

```ts
// src/modules/User/controllers/UserController.ts
await addToQueue('email', { to: user.email, firstName: user.firstName });
```

O worker processa o job e envia o e-mail via SMTP (nodemailer):

```ts
// src/core/queue.ts
generalQueue.process(async (job) => {
  switch (job.data.type) {
    case 'email': {
      const { to, firstName } = job.data.payload as { to: string; firstName: string };
      await sendWelcomeEmail(to, firstName);
      break;
    }
    // ... outros tipos de job
  }
});
```

O envio depende das variáveis `SMTP_*` em `.env` (ver `.env.example`). Se `SMTP_HOST` estiver vazio, o job só loga um aviso e não envia nada — útil para desenvolvimento local sem servidor SMTP.

O tipo `relatorio` existe no `switch` mas ainda não tem handler: hoje toda a geração de relatórios (`ReportsController.ts`) é síncrona e não passa pela fila.

## Como rodar o worker

A fila é processada dentro do próprio processo da API. Para rodar um worker dedicado (mesmo processamento, processo separado):

```bash
npm run worker:dev   # desenvolvimento
npm run worker       # produção (usa dist/)
```

## Como monitorar as filas

Acesse `/admin/queues` na API para visualizar o Bull Board e monitorar jobs em tempo real (requer login com papel `admin`).

---

# Exemplos de uso da API

- **POST /v1/users**: Criação de usuário (admin)
- **POST /v1/materials**: Criação de material (com validação)
- **POST /auth/login**: Login de usuário

Consulte o Swagger em `/api-docs` para mais exemplos e schemas.
