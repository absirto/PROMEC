# Exemplos de uso de filas Bull no ProMEC

## Exemplo: Pós-processamento ao criar usuário

Quando um usuário é criado, uma tarefa é adicionada à fila `general-queue` para pós-processamento, como envio de email de boas-vindas ou auditoria.

```ts
// src/controllers/UserController.ts
await addToQueue('user_created', { userId: user.id, email: user.email });
```

O worker processa o job:

```ts
// src/services/queue.ts
generalQueue.process(async (job) => {
  switch (job.data.type) {
    case 'user_created':
      // Exemplo: await sendWelcomeEmail(job.data.payload.email)
      break;
    // ... outros tipos de job
  }
});
```

## Como monitorar as filas

Acesse `/admin/queues` na API para visualizar o Bull Board e monitorar jobs em tempo real.

---

# Exemplos de uso da API

- **POST /v1/users**: Criação de usuário (admin)
- **POST /v1/materials**: Criação de material (com validação)
- **POST /auth/login**: Login de usuário

Consulte o Swagger em `/api-docs` para mais exemplos e schemas.
