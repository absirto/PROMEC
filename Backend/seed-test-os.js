const http = require('http');

const API = process.env.API_URL || 'http://localhost:3001/v1';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // Login
  const loginEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@admin.com';
  const loginPassword = process.env.ADMIN_DEFAULT_PASSWORD || '123456';
  const login = await request('POST', '/auth/login', { email: loginEmail, password: loginPassword });
  const token = login.data.token;
  console.log('✅ Logado');

  // Materiais
  const mat1 = await request('POST', '/materials', { name: 'Eletrodo Revestido E7018', unit: 'un', price: 4.20 }, token);
  const mat1Id = mat1.data?.id || mat1.id;
  console.log('🔩 Material 1:', mat1Id);

  const mat2 = await request('POST', '/materials', { name: 'Rolamento 6205-2RS', unit: 'un', price: 42.00 }, token);
  const mat2Id = mat2.data?.id || mat2.id;
  console.log('🔩 Material 2:', mat2Id);

  // Pessoa Funcionário
  const person2 = await request('POST', '/people', { type: 'NATURAL', naturalPerson: { name: 'Carlos Eduardo Silva', cpf: '12345678901' } }, token);
  const person2Id = person2.data?.id || person2.id;
  console.log('👤 Pessoa:', person2Id);

  // Funcionário
  const emp = await request('POST', '/employees', { personId: person2Id, role: 'Torneiro Mecânico', department: 'Usinagem', status: 'ACTIVE' }, token);
  const empId = emp.data?.id || emp.id;
  console.log('👷 Funcionário:', empId);

  // Serviço IDs existentes: 2=Torneamento CNC, 3=Soldagem MIG/MAG, 4=Retífica Cilíndrica
  // Material IDs: 2=Barra Aço, mat1Id=Eletrodo, mat2Id=Rolamento

  // Ordem de Serviço
  const os = await request('POST', '/service-orders', {
    personId: 1,
    description: 'Recuperação de Eixo de Transmissão - Motor WEG W22 150cv',
    status: 'Em Andamento',
    openingDate: '2026-06-10',
    workCenter: 'Oficina Central',
    plannedStartDate: '2026-06-11',
    plannedEndDate: '2026-06-18',
    plannedHours: 24,
    problemDescription: 'Eixo de transmissão do motor WEG W22 de 150cv apresenta desgaste excessivo no mancal, vibração anormal e aquecimento acima de 85°C. Cliente relata ruído metálico intermitente durante operação em carga plena. Necessário usinagem de recuperação, troca de rolamentos e balanceamento dinâmico.',
    technicalDiagnosis: 'Após inspeção visual e dimensional, constatou-se desgaste de 0.15mm no diâmetro do mancal principal. Rolamentos apresentam folga excessiva e marcas de brinelamento. Recomenda-se torneamento para recuperação dimensional, metalização da superfície, retífica final e substituição dos rolamentos.',
    profitPercent: 15,
    taxPercent: 8.5,
    services: [
      { serviceId: 2, employeeId: empId, hoursWorked: 8, unitPrice: 250.00, totalPrice: 2000.00 },
      { serviceId: 3, employeeId: empId, hoursWorked: 4, unitPrice: 180.00, totalPrice: 720.00 },
      { serviceId: 4, employeeId: empId, hoursWorked: 6, unitPrice: 320.00, totalPrice: 1920.00 }
    ],
    materials: [
      { materialId: 2, quantity: 12, unitPrice: 18.50, totalPrice: 222.00 },
      { materialId: mat1Id, quantity: 30, unitPrice: 4.20, totalPrice: 126.00 },
      { materialId: mat2Id, quantity: 2, unitPrice: 42.00, totalPrice: 84.00 }
    ]
  }, token);

  const osId = os.data?.id || os.id;
  console.log('');
  console.log('📄 Resposta completa:', JSON.stringify(os).substring(0, 200));
  console.log('');
  console.log(`🎉 OS criada! ID=${osId}`);
  console.log(`🖨️  Teste o PDF clicando no ícone de impressora na listagem de ordens.`);
})();
